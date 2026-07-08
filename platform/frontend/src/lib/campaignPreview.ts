import type { CampaignMetadata } from "@/lib/metadata";

const DEFAULT_SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_CHAIN_ID === "11155111"
    ? "https://ugraph.growfi.dev/subgraphs/growfi-sepolia/latest/gn"
    : "https://ugraph.growfi.dev/subgraphs/growfi/latest/gn";

export const CAMPAIGN_PREVIEW_SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL || DEFAULT_SUBGRAPH_URL;

export const CAMPAIGN_PREVIEW_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://growfi.dev";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const USD_SCALE = 10n ** 18n;

interface CampaignPreviewQueryData {
  campaign: {
    id: string;
    metadataURI: string | null;
    metadataVersion: string;
    state: "Funding" | "Active" | "Buyback" | "Ended";
    pricePerToken: string;
    minCap: string;
    maxCap: string;
    currentSupply: string;
    totalRaised: string;
    expectedAnnualHarvestUsd: string;
    firstHarvestYear: string;
  } | null;
}

export interface CampaignPreview {
  address: string;
  metadataURI: string | null;
  metadataVersion: string;
  name: string;
  description: string;
  location: string;
  productType: string;
  image: string | null;
  state: "Funding" | "Active" | "Buyback" | "Ended";
  pricePerToken: string;
  minCap: string;
  maxCap: string;
  currentSupply: string;
  totalRaised: string;
  expectedAnnualHarvestUsd: string;
  firstHarvestYear: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toBigInt(value: string | null | undefined): bigint {
  try {
    return value ? BigInt(value) : 0n;
  } catch {
    return 0n;
  }
}

function withSiteBase(pathname: string): string {
  return new URL(pathname, CAMPAIGN_PREVIEW_SITE_URL).toString();
}

function resolvePublicUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice("ipfs://".length)}`;
  }
  try {
    return new URL(uri, CAMPAIGN_PREVIEW_SITE_URL).toString();
  } catch {
    return null;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function stripRichText(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(p|h[1-6]|li)>/gi, " ")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const next = value.slice(0, maxLength - 1).trimEnd();
  const lastSpace = next.lastIndexOf(" ");
  const cut = lastSpace > maxLength * 0.65 ? next.slice(0, lastSpace) : next;
  return `${cut}…`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatDecimal(raw: bigint, decimals: number, maxFractionDigits: number): string {
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = raw % scale;
  const wholePart = whole.toLocaleString("en-US");
  if (fraction === 0n || maxFractionDigits === 0) return wholePart;

  const padded = fraction.toString().padStart(decimals, "0");
  const trimmed = padded.slice(0, maxFractionDigits).replace(/0+$/g, "");
  return trimmed ? `${wholePart}.${trimmed}` : wholePart;
}

export function formatUsd18(raw: bigint, maxFractionDigits = 0): string {
  return `$${formatDecimal(raw, 18, maxFractionDigits)}`;
}

export function campaignTargetUsd(preview: CampaignPreview | null): bigint {
  if (!preview) return 0n;
  const maxCap = toBigInt(preview.maxCap);
  const price = toBigInt(preview.pricePerToken);
  return maxCap > 0n && price > 0n ? (maxCap * price) / USD_SCALE : 0n;
}

export function campaignProgressPercent(preview: CampaignPreview | null): string {
  if (!preview) return "0%";
  const maxCap = toBigInt(preview.maxCap);
  const currentSupply = toBigInt(preview.currentSupply);
  if (maxCap === 0n) return "0%";
  const basisPoints = (currentSupply * 10_000n) / maxCap;
  const whole = basisPoints / 100n;
  const fraction = basisPoints % 100n;
  return fraction === 0n
    ? `${whole.toString()}%`
    : `${whole.toString()}.${fraction.toString().padStart(2, "0").replace(/0+$/g, "")}%`;
}

export function campaignPreviewTitle(
  preview: CampaignPreview | null,
  address: string,
): string {
  return truncateText(preview?.name || `Campaign ${shortAddress(address)}`, 72);
}

export function campaignPreviewDescription(preview: CampaignPreview | null): string {
  if (preview?.description) return truncateText(stripRichText(preview.description), 180);
  const parts = [preview?.productType, preview?.location].filter(Boolean);
  if (parts.length > 0) {
    return truncateText(`${parts.join(" in ")} campaign on GrowFi.`, 180);
  }
  return "Explore this GrowFi campaign: transparent onchain funding for real productive assets.";
}

export function campaignPreviewImageUrl(address: string): string {
  return withSiteBase(`/campaign/${address.toLowerCase()}/opengraph-image`);
}

async function queryCampaignPreview(address: string): Promise<CampaignPreviewQueryData["campaign"]> {
  const res = await fetch(CAMPAIGN_PREVIEW_SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
        query CampaignPreview($id: String!) {
          campaign(id: $id) {
            id
            metadataURI
            metadataVersion
            state
            pricePerToken
            minCap
            maxCap
            currentSupply
            totalRaised
            expectedAnnualHarvestUsd
            firstHarvestYear
          }
        }
      `,
      variables: { id: address.toLowerCase() },
    }),
    next: { revalidate: 60 },
  });

  if (!res.ok) return null;
  const body = (await res.json()) as {
    data?: CampaignPreviewQueryData;
    errors?: Array<{ message: string }>;
  };
  if (body.errors?.length || !body.data) return null;
  return body.data.campaign;
}

async function fetchCampaignPreviewMetadata(
  metadataURI: string | null,
): Promise<CampaignMetadata | null> {
  const uri = resolvePublicUri(metadataURI);
  if (!uri) return null;

  try {
    const res = await fetch(uri, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const body = (await res.json()) as unknown;
    if (!isRecord(body)) return null;

    return {
      name: asString(body.name),
      description: asString(body.description),
      location: asString(body.location),
      productType: asString(body.productType),
      image: resolvePublicUri(asNullableString(body.image)),
      dmrv: null,
      createdAt:
        typeof body.createdAt === "number" ? body.createdAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export async function getCampaignPreview(
  address: string,
): Promise<CampaignPreview | null> {
  if (!ADDRESS_RE.test(address)) return null;

  const campaign = await queryCampaignPreview(address);
  if (!campaign) return null;

  const metadata = await fetchCampaignPreviewMetadata(campaign.metadataURI);

  return {
    address: campaign.id,
    metadataURI: campaign.metadataURI,
    metadataVersion: campaign.metadataVersion,
    name:
      metadata?.name ||
      `Campaign ${shortAddress(campaign.id || address.toLowerCase())}`,
    description: metadata?.description || "",
    location: metadata?.location || "",
    productType: metadata?.productType || "",
    image: metadata?.image || null,
    state: campaign.state,
    pricePerToken: campaign.pricePerToken,
    minCap: campaign.minCap,
    maxCap: campaign.maxCap,
    currentSupply: campaign.currentSupply,
    totalRaised: campaign.totalRaised,
    expectedAnnualHarvestUsd: campaign.expectedAnnualHarvestUsd,
    firstHarvestYear: campaign.firstHarvestYear,
  };
}
