import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildInMemoryNotificationStore,
  type NotificationStore,
} from "./notifications-store.js";
import type { EmailPayload, EmailSender } from "./email.js";
import { runDigestCycle, type SubgraphFetcher } from "./notifier.js";

const PRODUCER = "0x1111111111111111111111111111111111111111";
const STAKER_A = "0x2222222222222222222222222222222222222222";
const STAKER_B = "0x3333333333333333333333333333333333333333";
const BUYER = "0x4444444444444444444444444444444444444444";
const CAMPAIGN = "0xcccccccccccccccccccccccccccccccccccccccc";

interface CapturedEmail {
  to: string;
  kind: string;
  payload: EmailPayload;
}

function captureEmails(): { sender: EmailSender; sent: CapturedEmail[] } {
  const sent: CapturedEmail[] = [];
  return {
    sent,
    sender: {
      async send(payload) {
        sent.push({ to: payload.to, kind: payload.kind, payload });
        return { delivered: true, id: `m-${sent.length}` };
      },
    },
  };
}

function makeStubSubgraph(events: {
  head?: number;
  purchases?: unknown[];
  seasonsEnded?: unknown[];
  seasonsReported?: unknown[];
  claimsCommitted?: unknown[];
  positions?: unknown[];
}): SubgraphFetcher {
  return async (query, _vars) => {
    if (query.includes("PositionsForSeasons")) {
      return { positions: events.positions ?? [] };
    }
    if (query.includes("DigestCycle")) {
      return {
        _meta: { block: { number: events.head ?? 100 } },
        purchases: events.purchases ?? [],
        seasonsEnded: events.seasonsEnded ?? [],
        seasonsReported: events.seasonsReported ?? [],
        claimsCommitted: events.claimsCommitted ?? [],
      };
    }
    // _meta-only first-boot probe.
    return { _meta: { block: { number: events.head ?? 100 } } };
  };
}

async function seedOptedIn(store: NotificationStore, address: string, email: string) {
  await store.upsert({
    address,
    email,
    optedIn: true,
    signedMessage: "x",
    signature: "0x",
    signedAt: 1,
  });
}

describe("notifier · first run seeds cursors and sends nothing", () => {
  it("returns seeded:true and persists head as cursor", async () => {
    const store = buildInMemoryNotificationStore();
    const { sender, sent } = captureEmails();
    const result = await runDigestCycle({
      store,
      email: sender,
      fetchSubgraph: makeStubSubgraph({ head: 5000 }),
      appUrl: "https://growfi.test",
      unsubSecret: "s",
      now: () => 1_700_000_000_000,
    });
    assert.equal(result.seeded, true);
    assert.equal(result.notified, 0);
    assert.equal(sent.length, 0);
    assert.equal(result.cursor.lastPurchaseBlock, 5000);
    assert.ok(result.cursor.lastSeasonEndedTs > 0);
  });
});

describe("notifier · digest cycle", () => {
  it("emails the producer on a new Purchase", async () => {
    const store = buildInMemoryNotificationStore();
    await store.saveCursor({
      lastPurchaseBlock: 100,
      lastSeasonEndedTs: 1_000_000,
      lastSeasonReportedTs: 1_000_000,
      lastClaimCommittedTs: 1_000_000,
      updatedAt: 1,
    });
    await seedOptedIn(store, PRODUCER, "producer@growfi.dev");

    const { sender, sent } = captureEmails();
    const result = await runDigestCycle({
      store,
      email: sender,
      fetchSubgraph: makeStubSubgraph({
        head: 200,
        purchases: [
          {
            id: "0xtx-0",
            buyer: BUYER,
            paymentToken: "0xpaytoken",
            paymentAmount: "144000000",
            campaignTokensOut: "1000000000000000000000",
            timestamp: "1700000300",
            block: "150",
            transactionHash: "0xtx",
            campaign: {
              id: CAMPAIGN,
              producer: PRODUCER,
              metadataURI: null,
              metadataVersion: "1",
            },
          },
        ],
      }),
      appUrl: "https://growfi.test",
      unsubSecret: "s",
      now: () => 1_700_000_500_000,
    });

    assert.equal(result.scanned.purchases, 1);
    assert.equal(result.notified, 1);
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.to, "producer@growfi.dev");
    assert.equal(sent[0]!.kind, "notifications_digest");

    const items = sent[0]!.payload.data.digest!.items;
    assert.equal(items.length, 1);
    assert.match(items[0]!.headline, /New buy/);
    assert.match(items[0]!.link, /\/campaign\/0xc{40}\?tab=invest/);
    assert.match(sent[0]!.payload.data.digest!.unsubscribeUrl, /unsubscribe\?token=/);
    assert.equal(result.cursor.lastPurchaseBlock, 150);
  });

  it("skips opted-out addresses even when events match", async () => {
    const store = buildInMemoryNotificationStore();
    await store.saveCursor({
      lastPurchaseBlock: 100,
      lastSeasonEndedTs: 1_000_000,
      lastSeasonReportedTs: 1_000_000,
      lastClaimCommittedTs: 1_000_000,
      updatedAt: 1,
    });
    // Opted out — must NOT be emailed.
    await store.upsert({
      address: PRODUCER,
      email: "producer@growfi.dev",
      optedIn: false,
      signedMessage: "x",
      signature: "0x",
      signedAt: 1,
    });

    const { sender, sent } = captureEmails();
    await runDigestCycle({
      store,
      email: sender,
      fetchSubgraph: makeStubSubgraph({
        purchases: [
          {
            id: "x",
            buyer: BUYER,
            paymentToken: "0x",
            paymentAmount: "1",
            campaignTokensOut: "1",
            timestamp: "1700000300",
            block: "150",
            transactionHash: "0xtx",
            campaign: {
              id: CAMPAIGN,
              producer: PRODUCER,
              metadataURI: null,
              metadataVersion: "1",
            },
          },
        ],
      }),
      appUrl: "https://growfi.test",
      unsubSecret: "s",
      now: () => 1_700_000_500_000,
    });

    assert.equal(sent.length, 0);
  });

  it("fans out a HarvestReported to all yield-holders for that season", async () => {
    const store = buildInMemoryNotificationStore();
    await store.saveCursor({
      lastPurchaseBlock: 100,
      lastSeasonEndedTs: 1_000_000,
      lastSeasonReportedTs: 1_000_000,
      lastClaimCommittedTs: 1_000_000,
      updatedAt: 1,
    });
    await seedOptedIn(store, STAKER_A, "alice@growfi.dev");
    await seedOptedIn(store, STAKER_B, "bob@growfi.dev");

    const { sender, sent } = captureEmails();
    await runDigestCycle({
      store,
      email: sender,
      fetchSubgraph: makeStubSubgraph({
        seasonsReported: [
          {
            id: "season-1",
            seasonId: "1",
            reportedAt: "1700100000",
            totalProductUnits: "250000000000000000000",
            campaign: {
              id: CAMPAIGN,
              producer: PRODUCER,
              metadataURI: null,
              metadataVersion: "1",
            },
          },
        ],
        positions: [
          { user: STAKER_A, seasonId: "1", campaign: { id: CAMPAIGN } },
          { user: STAKER_B, seasonId: "1", campaign: { id: CAMPAIGN } },
          // Position in a different campaign — must NOT be picked up.
          {
            user: PRODUCER,
            seasonId: "1",
            campaign: { id: "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead" },
          },
        ],
      }),
      appUrl: "https://growfi.test",
      unsubSecret: "s",
      now: () => 1_700_200_000_000,
    });

    const recipients = sent.map((e) => e.to).sort();
    assert.deepEqual(recipients, ["alice@growfi.dev", "bob@growfi.dev"]);
    for (const e of sent) {
      assert.match(e.payload.data.digest!.items[0]!.headline, /Harvest reported/);
      assert.match(e.payload.data.digest!.items[0]!.link, /tab=harvest/);
    }
  });

  it("aggregates multiple events for the same recipient into one digest", async () => {
    const store = buildInMemoryNotificationStore();
    await store.saveCursor({
      lastPurchaseBlock: 100,
      lastSeasonEndedTs: 1_000_000,
      lastSeasonReportedTs: 1_000_000,
      lastClaimCommittedTs: 1_000_000,
      updatedAt: 1,
    });
    await seedOptedIn(store, PRODUCER, "producer@growfi.dev");

    const { sender, sent } = captureEmails();
    await runDigestCycle({
      store,
      email: sender,
      fetchSubgraph: makeStubSubgraph({
        purchases: [
          {
            id: "p1",
            buyer: BUYER,
            paymentToken: "0x",
            paymentAmount: "1",
            campaignTokensOut: "1000000000000000000",
            timestamp: "1700000300",
            block: "150",
            transactionHash: "0xtx1",
            campaign: {
              id: CAMPAIGN,
              producer: PRODUCER,
              metadataURI: null,
              metadataVersion: "1",
            },
          },
          {
            id: "p2",
            buyer: BUYER,
            paymentToken: "0x",
            paymentAmount: "2",
            campaignTokensOut: "2000000000000000000",
            timestamp: "1700000400",
            block: "151",
            transactionHash: "0xtx2",
            campaign: {
              id: CAMPAIGN,
              producer: PRODUCER,
              metadataURI: null,
              metadataVersion: "1",
            },
          },
        ],
        claimsCommitted: [
          {
            id: "c1",
            user: BUYER,
            yieldBurned: "10000000000000000000",
            usdcAmount: "50000000",
            claimedAt: "1700000500",
            season: { seasonId: "1" },
            campaign: {
              id: CAMPAIGN,
              producer: PRODUCER,
              metadataURI: null,
              metadataVersion: "1",
            },
          },
        ],
      }),
      appUrl: "https://growfi.test",
      unsubSecret: "s",
      now: () => 1_700_000_600_000,
    });

    assert.equal(sent.length, 1, "single recipient receives one digest, not three");
    assert.equal(sent[0]!.payload.data.digest!.items.length, 3);
  });

  it("advances cursors monotonically", async () => {
    const store = buildInMemoryNotificationStore();
    await store.saveCursor({
      lastPurchaseBlock: 100,
      lastSeasonEndedTs: 1_000_000,
      lastSeasonReportedTs: 1_000_000,
      lastClaimCommittedTs: 1_000_000,
      updatedAt: 1,
    });
    const { sender } = captureEmails();
    const result = await runDigestCycle({
      store,
      email: sender,
      fetchSubgraph: makeStubSubgraph({
        purchases: [
          {
            id: "p",
            buyer: BUYER,
            paymentToken: "0x",
            paymentAmount: "1",
            campaignTokensOut: "1",
            timestamp: "1700000300",
            block: "175",
            transactionHash: "0xt",
            campaign: {
              id: CAMPAIGN,
              producer: PRODUCER,
              metadataURI: null,
              metadataVersion: "1",
            },
          },
        ],
        seasonsEnded: [
          {
            id: "s",
            seasonId: "1",
            endTime: "1700050000",
            campaign: {
              id: CAMPAIGN,
              producer: PRODUCER,
              metadataURI: null,
              metadataVersion: "1",
            },
          },
        ],
      }),
      appUrl: "https://growfi.test",
      unsubSecret: "s",
      now: () => 1_700_100_000_000,
    });
    assert.equal(result.cursor.lastPurchaseBlock, 175);
    assert.equal(result.cursor.lastSeasonEndedTs, 1_700_050_000);
    // Untouched cursors stay where they were.
    assert.equal(result.cursor.lastSeasonReportedTs, 1_000_000);
    assert.equal(result.cursor.lastClaimCommittedTs, 1_000_000);
  });
});
