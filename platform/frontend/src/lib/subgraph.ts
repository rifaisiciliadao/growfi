import { useQuery } from "@tanstack/react-query";

const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ||
  "https://api.goldsky.com/api/public/project_cmo1ydnmbj6tv01uwahhbeenr/subgraphs/growfi/prod/gn";

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Subgraph HTTP ${res.status}`);
  const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (body.errors?.length) {
    throw new Error(body.errors.map((e) => e.message).join(", "));
  }
  if (!body.data) throw new Error("Empty subgraph response");
  return body.data;
}

export interface SubgraphCampaign {
  id: string;
  producer: string;
  campaignToken: string;
  yieldToken: string;
  stakingVault: string;
  harvestManager: string;
  pricePerToken: string;
  minCap: string;
  maxCap: string;
  fundingDeadline: string;
  seasonDuration: string;
  minProductClaim: string;
  currentSupply: string;
  totalStaked: string;
  totalRaised: string;
  currentYieldRate: string;
  state: "Funding" | "Active" | "Buyback" | "Ended";
  paused: boolean;
  createdAt: string;
  createdAtBlock: string;
  activatedAt: string | null;
}

const CAMPAIGN_FIELDS = `
  id
  producer
  campaignToken
  yieldToken
  stakingVault
  harvestManager
  pricePerToken
  minCap
  maxCap
  fundingDeadline
  seasonDuration
  minProductClaim
  currentSupply
  totalStaked
  totalRaised
  currentYieldRate
  state
  paused
  createdAt
  createdAtBlock
  activatedAt
  metadataURI
  metadataVersion
`;

export function useSubgraphCampaigns() {
  return useQuery({
    queryKey: ["subgraph", "campaigns"],
    queryFn: async () => {
      const data = await gql<{ campaigns: SubgraphCampaign[] }>(`
        query Campaigns {
          campaigns(first: 100, orderBy: createdAt, orderDirection: desc) {
            ${CAMPAIGN_FIELDS}
          }
        }
      `);
      return data.campaigns;
    },
    refetchInterval: 15_000,
  });
}

export function useSubgraphCampaign(address: string | undefined) {
  return useQuery({
    queryKey: ["subgraph", "campaign", address?.toLowerCase()],
    enabled: !!address,
    queryFn: async () => {
      if (!address) return null;
      const data = await gql<{ campaign: SubgraphCampaign | null }>(
        `
        query Campaign($id: ID!) {
          campaign(id: $id) {
            ${CAMPAIGN_FIELDS}
          }
        }
        `,
        { id: address.toLowerCase() },
      );
      return data.campaign;
    },
    refetchInterval: 15_000,
  });
}

export interface SubgraphSeason {
  id: string;
  seasonId: string;
  startTime: string;
  endTime: string | null;
  active: boolean;
  reported: boolean;
  reportedAt: string | null;
  totalHarvestValueUSD: string | null;
  holderPool: string | null;
  totalYieldSupply: string | null;
  totalProductUnits: string | null;
  merkleRoot: string | null;
  claimStart: string | null;
  claimEnd: string | null;
  usdcDeadline: string | null;
  usdcDeposited: string;
  usdcOwed: string;
}

export function useCampaignSeasons(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["subgraph", "seasons", campaignId?.toLowerCase()],
    enabled: !!campaignId,
    queryFn: async () => {
      if (!campaignId) return [];
      const data = await gql<{ seasons: SubgraphSeason[] }>(
        `
        query Seasons($campaign: String!) {
          seasons(
            where: { campaign: $campaign }
            orderBy: seasonId
            orderDirection: desc
            first: 50
          ) {
            id
            seasonId
            startTime
            endTime
            active
            reported
            reportedAt
            totalHarvestValueUSD
            holderPool
            totalYieldSupply
            totalProductUnits
            merkleRoot
            claimStart
            claimEnd
            usdcDeadline
            usdcDeposited
            usdcOwed
          }
        }
        `,
        { campaign: campaignId.toLowerCase() },
      );
      return data.seasons;
    },
    refetchInterval: 15_000,
  });
}

export interface UserPortfolio {
  purchases: Array<{
    id: string;
    campaign: { id: string; pricePerToken: string; state: string };
    paymentToken: string;
    paymentAmount: string;
    campaignTokensOut: string;
    timestamp: string;
  }>;
  positions: Array<{
    id: string;
    positionId: string;
    campaign: {
      id: string;
      stakingVault: string;
      campaignToken: string;
      pricePerToken: string;
      state: string;
      metadataURI: string | null;
      metadataVersion: string;
    };
    amount: string;
    startTime: string;
    seasonId: string;
    yieldClaimed: string;
    active: boolean;
  }>;
  claims: Array<{
    id: string;
    campaign: { id: string };
    season: { seasonId: string; usdcDeposited: string; usdcOwed: string };
    redemptionType: string;
    yieldBurned: string;
    productAmount: string;
    usdcAmount: string;
    usdcClaimed: string;
    fulfilled: boolean;
  }>;
}

export function useUserPortfolio(user: string | undefined) {
  return useQuery({
    queryKey: ["subgraph", "portfolio", user?.toLowerCase()],
    enabled: !!user,
    queryFn: async (): Promise<UserPortfolio> => {
      if (!user) return { purchases: [], positions: [], claims: [] };
      const addr = user.toLowerCase();
      const data = await gql<UserPortfolio>(
        `
        query UserPortfolio($user: Bytes!) {
          purchases(
            where: { buyer: $user }
            orderBy: timestamp
            orderDirection: desc
            first: 100
          ) {
            id
            campaign { id pricePerToken state }
            paymentToken
            paymentAmount
            campaignTokensOut
            timestamp
          }
          positions(
            where: { user: $user, active: true }
            orderBy: createdAt
            orderDirection: desc
            first: 100
          ) {
            id
            positionId
            campaign {
              id
              stakingVault
              campaignToken
              pricePerToken
              state
              metadataURI
              metadataVersion
            }
            amount
            startTime
            seasonId
            yieldClaimed
            active
          }
          claims(
            where: { user: $user }
            orderBy: claimedAt
            orderDirection: desc
            first: 100
          ) {
            id
            campaign { id }
            season { seasonId usdcDeposited usdcOwed }
            redemptionType
            yieldBurned
            productAmount
            usdcAmount
            usdcClaimed
            fulfilled
          }
        }
        `,
        { user: addr },
      );
      return data;
    },
    refetchInterval: 20_000,
  });
}

export interface SubgraphProducer {
  id: string;
  profileURI: string | null;
  version: string;
  updatedAt: string | null;
}

export function useSubgraphProducer(address: string | undefined) {
  return useQuery({
    queryKey: ["subgraph", "producer", address?.toLowerCase()],
    enabled: !!address,
    queryFn: async () => {
      if (!address) return null;
      const data = await gql<{ producer: SubgraphProducer | null }>(
        `
        query Producer($id: ID!) {
          producer(id: $id) {
            id
            profileURI
            version
            updatedAt
          }
        }
        `,
        { id: address.toLowerCase() },
      );
      return data.producer;
    },
    refetchInterval: 20_000,
  });
}

export function useProducerCampaigns(producerAddress: string | undefined) {
  return useQuery({
    queryKey: ["subgraph", "producer-campaigns", producerAddress?.toLowerCase()],
    enabled: !!producerAddress,
    queryFn: async () => {
      if (!producerAddress) return [];
      const data = await gql<{ campaigns: SubgraphCampaign[] }>(
        `
        query ProducerCampaigns($producer: Bytes!) {
          campaigns(
            where: { producer: $producer }
            orderBy: createdAt
            orderDirection: desc
            first: 100
          ) {
            ${CAMPAIGN_FIELDS}
          }
        }
        `,
        { producer: producerAddress.toLowerCase() },
      );
      return data.campaigns;
    },
    refetchInterval: 20_000,
  });
}

export interface SubgraphMeta {
  block: { number: number; hash: string };
  hasIndexingErrors: boolean;
}

export function useSubgraphMeta() {
  return useQuery({
    queryKey: ["subgraph", "meta"],
    queryFn: async () =>
      (await gql<{ _meta: SubgraphMeta }>("{ _meta { block { number hash } hasIndexingErrors } }"))._meta,
    refetchInterval: 30_000,
  });
}
