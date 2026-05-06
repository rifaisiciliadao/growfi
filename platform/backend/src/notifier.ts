import type { DigestItem, EmailSender } from "./email.js";
import { buildUnsubscribeUrl } from "./notifications.js";
import type {
  NotificationCursor,
  NotificationStore,
} from "./notifications-store.js";

export interface SubgraphFetcher {
  (query: string, variables: Record<string, unknown>): Promise<unknown>;
}

export interface MetadataFetcher {
  (uri: string): Promise<{ name?: string } | null>;
}

export interface NotifierDeps {
  store: NotificationStore;
  email: EmailSender;
  fetchSubgraph: SubgraphFetcher;
  /** Optional: fetches off-chain metadata JSON for human campaign names. */
  fetchMetadata?: MetadataFetcher;
  appUrl: string;
  unsubSecret: string;
  /** API base used inside email links. Defaults to `${appUrl}/api`. */
  apiBase?: string;
  /** Stable clock — primarily for tests. */
  now?: () => number;
}

export interface NotifierResult {
  scanned: {
    purchases: number;
    seasonsEnded: number;
    seasonsReported: number;
    claimsCommitted: number;
  };
  notified: number;
  emails: { to: string; ok: boolean; error?: string }[];
  cursor: NotificationCursor;
  /** True on the very first run when we just seed cursors and skip sending. */
  seeded: boolean;
}

interface SubCampaignRef {
  id: string;
  producer: string;
  metadataURI?: string | null;
  metadataVersion?: string;
}

interface SubPurchase {
  id: string;
  buyer: string;
  paymentToken: string;
  paymentAmount: string;
  campaignTokensOut: string;
  timestamp: string;
  block: string;
  transactionHash: string;
  campaign: SubCampaignRef;
}

interface SubSeason {
  id: string;
  seasonId: string;
  endTime?: string | null;
  reportedAt?: string | null;
  totalProductUnits?: string | null;
  campaign: SubCampaignRef;
}

interface SubClaim {
  id: string;
  user: string;
  yieldBurned: string;
  usdcAmount: string;
  claimedAt: string;
  season: { seasonId: string };
  campaign: SubCampaignRef;
}

interface SubPosition {
  user: string;
  seasonId: string;
  campaign: { id: string };
}

interface SubMeta {
  block: { number: number };
}

interface EventBundle {
  meta: SubMeta;
  purchases: SubPurchase[];
  seasonsEnded: SubSeason[];
  seasonsReported: SubSeason[];
  claimsCommitted: SubClaim[];
}

const QUERY_EVENTS = `
query DigestCycle($sinceBlock: BigInt!, $sinceTs: BigInt!) {
  _meta { block { number } }
  purchases(
    where: { block_gt: $sinceBlock }
    orderBy: block
    orderDirection: asc
    first: 500
  ) {
    id
    buyer
    paymentToken
    paymentAmount
    campaignTokensOut
    timestamp
    block
    transactionHash
    campaign { id producer metadataURI metadataVersion }
  }
  seasonsEnded: seasons(
    where: { endTime_gt: $sinceTs, active: false }
    orderBy: endTime
    orderDirection: asc
    first: 500
  ) {
    id
    seasonId
    endTime
    campaign { id producer metadataURI metadataVersion }
  }
  seasonsReported: seasons(
    where: { reportedAt_gt: $sinceTs, reported: true }
    orderBy: reportedAt
    orderDirection: asc
    first: 500
  ) {
    id
    seasonId
    reportedAt
    totalProductUnits
    campaign { id producer metadataURI metadataVersion }
  }
  claimsCommitted: claims(
    where: { claimedAt_gt: $sinceTs, redemptionType: "usdc" }
    orderBy: claimedAt
    orderDirection: asc
    first: 500
  ) {
    id
    user
    yieldBurned
    usdcAmount
    claimedAt
    season { seasonId }
    campaign { id producer metadataURI metadataVersion }
  }
}
`;

const QUERY_POSITIONS_FOR_SEASONS = `
query PositionsForSeasons($seasonIds: [BigInt!]!) {
  positions(
    where: { seasonId_in: $seasonIds }
    first: 1000
  ) {
    user
    seasonId
    campaign { id }
  }
}
`;

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Best-effort decimal-string → human format. We don't know each token's
 * decimals here (would need a multicall), so we just chunk thousands and
 * trim. The buyer can always tap through to the campaign page for the exact
 * number; the digest is a heads-up, not an accounting document.
 */
function fmtBig(s: string, decimals = 18): string {
  if (!s || s === "0") return "0";
  const negative = s.startsWith("-");
  const digits = negative ? s.slice(1) : s;
  if (digits.length <= decimals) {
    const padded = digits.padStart(decimals + 1, "0");
    const whole = padded.slice(0, -decimals) || "0";
    const frac = padded.slice(-decimals).replace(/0+$/, "");
    return `${negative ? "-" : ""}${whole}${frac ? "." + frac.slice(0, 4) : ""}`;
  }
  const whole = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals).replace(/0+$/, "");
  const wholeFmt = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${wholeFmt}${frac ? "." + frac.slice(0, 4) : ""}`;
}

interface MetadataResolver {
  nameFor(campaignId: string, uri: string | null | undefined, version: string | undefined): Promise<string>;
}

function buildMetadataResolver(
  fetchMetadata: MetadataFetcher | undefined,
): MetadataResolver {
  const cache = new Map<string, string>();
  return {
    async nameFor(campaignId, uri, version) {
      const key = `${campaignId.toLowerCase()}|${version ?? "0"}`;
      const cached = cache.get(key);
      if (cached !== undefined) return cached;
      let name = shortAddr(campaignId);
      if (uri && fetchMetadata) {
        try {
          const meta = await fetchMetadata(uri);
          if (meta?.name) name = meta.name;
        } catch {
          // fall through to the address fallback
        }
      }
      cache.set(key, name);
      return name;
    },
  };
}

function pushItem(
  bag: Map<string, DigestItem[]>,
  recipient: string,
  item: DigestItem,
): void {
  const lower = recipient.toLowerCase();
  const list = bag.get(lower) ?? [];
  list.push(item);
  bag.set(lower, list);
}

function campaignLink(appUrl: string, campaignId: string, tab?: string): string {
  const base = `${appUrl.replace(/\/$/, "")}/campaign/${campaignId.toLowerCase()}`;
  return tab ? `${base}?tab=${tab}` : base;
}

export async function runDigestCycle(deps: NotifierDeps): Promise<NotifierResult> {
  const now = deps.now ?? (() => Date.now());
  const cursor = await deps.store.loadCursor();

  // First boot: seed cursors at current head and skip sending. Without this,
  // we'd dump the entire indexed history into producer inboxes on day 1.
  if (cursor.lastPurchaseBlock === 0) {
    const head = await fetchHead(deps.fetchSubgraph);
    const nowSec = Math.floor(now() / 1000);
    const seeded: NotificationCursor = {
      lastPurchaseBlock: head,
      lastSeasonEndedTs: nowSec,
      lastSeasonReportedTs: nowSec,
      lastClaimCommittedTs: nowSec,
      updatedAt: now(),
    };
    await deps.store.saveCursor(seeded);
    return {
      scanned: {
        purchases: 0,
        seasonsEnded: 0,
        seasonsReported: 0,
        claimsCommitted: 0,
      },
      notified: 0,
      emails: [],
      cursor: seeded,
      seeded: true,
    };
  }

  const sinceBlock = cursor.lastPurchaseBlock;
  const sinceTs = Math.min(
    cursor.lastSeasonEndedTs,
    cursor.lastSeasonReportedTs,
    cursor.lastClaimCommittedTs,
  );

  const events = (await deps.fetchSubgraph(QUERY_EVENTS, {
    sinceBlock: sinceBlock.toString(),
    sinceTs: sinceTs.toString(),
  })) as EventBundle;

  const seasonRefs = [
    ...events.seasonsEnded.map((s) => ({
      campaign: s.campaign.id.toLowerCase(),
      seasonId: s.seasonId,
    })),
    ...events.seasonsReported.map((s) => ({
      campaign: s.campaign.id.toLowerCase(),
      seasonId: s.seasonId,
    })),
  ];
  const stakerMap = await fetchPositionsByCampaignSeason(
    deps.fetchSubgraph,
    seasonRefs,
  );
  const meta = buildMetadataResolver(deps.fetchMetadata);

  const recipients = new Map<string, DigestItem[]>();

  for (const p of events.purchases) {
    const campaignName = await meta.nameFor(
      p.campaign.id,
      p.campaign.metadataURI,
      p.campaign.metadataVersion,
    );
    pushItem(recipients, p.campaign.producer, {
      headline: `New buy on ${campaignName}`,
      body: `${shortAddr(p.buyer)} bought ${fmtBig(p.campaignTokensOut)} campaign tokens (paid ${fmtBig(p.paymentAmount, 6)} of payment token).`,
      link: campaignLink(deps.appUrl, p.campaign.id, "invest"),
    });
  }

  for (const s of events.seasonsEnded) {
    const campaignName = await meta.nameFor(
      s.campaign.id,
      s.campaign.metadataURI,
      s.campaign.metadataVersion,
    );
    const stakers =
      stakerMap.get(`${s.campaign.id.toLowerCase()}|${s.seasonId}`) ?? [];
    for (const addr of stakers) {
      pushItem(recipients, addr, {
        headline: `Season ${s.seasonId} ended on ${campaignName}`,
        body: `Claim your earned $YIELD before the next season starts.`,
        link: campaignLink(deps.appUrl, s.campaign.id, "stake"),
      });
    }
  }

  for (const s of events.seasonsReported) {
    const campaignName = await meta.nameFor(
      s.campaign.id,
      s.campaign.metadataURI,
      s.campaign.metadataVersion,
    );
    const holders =
      stakerMap.get(`${s.campaign.id.toLowerCase()}|${s.seasonId}`) ?? [];
    for (const addr of holders) {
      pushItem(recipients, addr, {
        headline: `Harvest reported on ${campaignName}`,
        body: `Season ${s.seasonId}: redeem your $YIELD for product (Merkle proof) or USDC before the claim window closes.`,
        link: campaignLink(deps.appUrl, s.campaign.id, "harvest"),
      });
    }
  }

  for (const c of events.claimsCommitted) {
    const campaignName = await meta.nameFor(
      c.campaign.id,
      c.campaign.metadataURI,
      c.campaign.metadataVersion,
    );
    pushItem(recipients, c.campaign.producer, {
      headline: `New USDC commitment on ${campaignName}`,
      body: `A holder committed ${fmtBig(c.yieldBurned)} $YIELD for season ${c.season.seasonId} → owes ~${fmtBig(c.usdcAmount, 6)} USDC. Top up the pool before the deposit deadline.`,
      link: campaignLink(deps.appUrl, c.campaign.id, "manage"),
    });
  }

  const optedIn = await deps.store.listOptedIn();
  const optedInMap = new Map(optedIn.map((r) => [r.address, r]));

  const emails: NotifierResult["emails"] = [];
  let notified = 0;

  for (const [addr, items] of recipients) {
    const row = optedInMap.get(addr);
    if (!row || !row.optedIn || !row.email) continue;
    const unsubscribeUrl = buildUnsubscribeUrl({
      appUrl: deps.appUrl,
      apiBase: deps.apiBase,
      unsubSecret: deps.unsubSecret,
      address: addr,
    });
    try {
      const result = await deps.email.send({
        to: row.email,
        kind: "notifications_digest",
        data: {
          appUrl: deps.appUrl,
          digest: { items, unsubscribeUrl },
        },
      });
      emails.push({ to: row.email, ok: result.delivered, error: result.error });
      if (result.delivered) notified += 1;
    } catch (err) {
      emails.push({
        to: row.email,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const next: NotificationCursor = {
    lastPurchaseBlock: events.purchases.reduce(
      (m, p) => Math.max(m, Number(p.block)),
      cursor.lastPurchaseBlock,
    ),
    lastSeasonEndedTs: events.seasonsEnded.reduce(
      (m, s) => Math.max(m, Number(s.endTime ?? 0)),
      cursor.lastSeasonEndedTs,
    ),
    lastSeasonReportedTs: events.seasonsReported.reduce(
      (m, s) => Math.max(m, Number(s.reportedAt ?? 0)),
      cursor.lastSeasonReportedTs,
    ),
    lastClaimCommittedTs: events.claimsCommitted.reduce(
      (m, c) => Math.max(m, Number(c.claimedAt)),
      cursor.lastClaimCommittedTs,
    ),
    updatedAt: now(),
  };
  await deps.store.saveCursor(next);

  return {
    scanned: {
      purchases: events.purchases.length,
      seasonsEnded: events.seasonsEnded.length,
      seasonsReported: events.seasonsReported.length,
      claimsCommitted: events.claimsCommitted.length,
    },
    notified,
    emails,
    cursor: next,
    seeded: false,
  };
}

async function fetchHead(fetchSubgraph: SubgraphFetcher): Promise<number> {
  const res = (await fetchSubgraph(`{ _meta { block { number } } }`, {})) as {
    _meta: SubMeta;
  };
  return Number(res._meta?.block?.number ?? 0);
}

async function fetchPositionsByCampaignSeason(
  fetchSubgraph: SubgraphFetcher,
  refs: Array<{ campaign: string; seasonId: string }>,
): Promise<Map<string, string[]>> {
  if (refs.length === 0) return new Map();
  const seasonIds = Array.from(new Set(refs.map((r) => r.seasonId)));
  const data = (await fetchSubgraph(QUERY_POSITIONS_FOR_SEASONS, {
    seasonIds,
  })) as { positions: SubPosition[] };

  // Filter client-side to (campaign, seasonId) pairs we asked about.
  const wanted = new Set(refs.map((r) => `${r.campaign}|${r.seasonId}`));
  const out = new Map<string, string[]>();
  for (const p of data.positions) {
    const key = `${p.campaign.id.toLowerCase()}|${p.seasonId}`;
    if (!wanted.has(key)) continue;
    const list = out.get(key) ?? [];
    const lower = p.user.toLowerCase();
    if (!list.includes(lower)) list.push(lower);
    out.set(key, list);
  }
  return out;
}

/**
 * Build the standard production fetcher against any GraphQL endpoint. Errors
 * surface as thrown exceptions; the caller can wrap with try/catch.
 */
export function buildSubgraphFetcher(url: string): SubgraphFetcher {
  return async (query, variables) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Subgraph HTTP ${res.status}`);
    const body = (await res.json()) as {
      data?: unknown;
      errors?: Array<{ message: string }>;
    };
    if (body.errors?.length) {
      throw new Error(body.errors.map((e) => e.message).join(", "));
    }
    if (body.data === undefined) throw new Error("Empty subgraph response");
    return body.data;
  };
}

/**
 * Fetches off-chain metadata JSON, with a 1KB minimum-size guard so DO Spaces
 * 404 stubs don't poison the cache (mirrors the seed-demo.sh defensive pattern).
 */
export function buildMetadataFetcher(): MetadataFetcher {
  return async (uri) => {
    if (!uri) return null;
    try {
      const res = await fetch(uri, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const text = await res.text();
      if (text.length < 32) return null;
      return JSON.parse(text) as { name?: string };
    } catch {
      return null;
    }
  };
}

export interface NotifierLoopHandle {
  stop: () => void;
}

/**
 * Runs `runDigestCycle` on `intervalMs` cadence. Returns a handle whose
 * `stop()` cancels the next tick. Cycles never overlap — a still-in-flight
 * run is awaited before the next setTimeout fires.
 */
export function startNotifierLoop(
  deps: NotifierDeps,
  opts: {
    intervalMs: number;
    onResult?: (result: NotifierResult) => void;
    onError?: (err: unknown) => void;
  },
): NotifierLoopHandle {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async () => {
    if (stopped) return;
    try {
      const result = await runDigestCycle(deps);
      opts.onResult?.(result);
    } catch (err) {
      opts.onError?.(err);
    }
    if (!stopped) {
      timer = setTimeout(tick, opts.intervalMs);
    }
  };

  // First tick happens after intervalMs, not immediately, so the server
  // finishes booting before we start hitting the subgraph.
  timer = setTimeout(tick, opts.intervalMs);

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
