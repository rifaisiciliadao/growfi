import { createPublicClient, http, getAddress, type Address } from "viem";
import { baseSepolia } from "viem/chains";

const SUBGRAPH_URL =
  process.env.SUBGRAPH_URL ||
  "https://api.goldsky.com/api/public/project_cmo1ydnmbj6tv01uwahhbeenr/subgraphs/growfi/prod/gn";

const RPC_URL = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

/**
 * Minimal StakingVault ABI — just the two views we need.
 * Kept local so the backend stays independent from the frontend bundle.
 */
const stakingVaultAbi = [
  {
    type: "function",
    name: "earned",
    stateMutability: "view",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "seasonTotalYieldOwed",
    stateMutability: "view",
    inputs: [{ name: "seasonId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

interface SubgraphPosition {
  positionId: string;
  user: string;
  amount: string;
  yieldClaimed: string;
  active: boolean;
  seasonId: string;
}

interface SubgraphCampaignRef {
  stakingVault: string;
  yieldToken: string;
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Subgraph HTTP ${res.status}`);
  const body = (await res.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };
  if (body.errors?.length) {
    throw new Error(body.errors.map((e) => e.message).join(", "));
  }
  if (!body.data) throw new Error("Empty subgraph response");
  return body.data;
}

export interface SnapshotHolder {
  user: Address;
  yieldAmount: bigint;
}

export interface SnapshotResult {
  campaign: Address;
  seasonId: bigint;
  stakingVault: Address;
  yieldToken: Address;
  totalYield: bigint;
  seasonTotalYieldOwed: bigint | null;
  holders: SnapshotHolder[];
  notes: string[];
}

/**
 * Compute per-user $YIELD for a given (campaign, seasonId):
 *
 *   yieldPerUser = Σ (position.yieldClaimed + earned(positionId))
 *
 * where `position` iterates all subgraph Position entities that currently
 * have `seasonId == target`. Inactive positions (fully unstaked with
 * penalty) are skipped.
 *
 * Caveats (documented in `notes` of the returned payload):
 * - `position.yieldClaimed` is cumulative per position across its
 *   lifetime, not per-season. If a position was restaked from an
 *   earlier season into this one, its yieldClaimed may over-count.
 *   The MVP assumption is that positions are not restaked before
 *   reportHarvest — true for first-season reports.
 * - Peer-to-peer $YIELD token transfers are not reflected here — the
 *   snapshot is "yield earned by position", not "current ERC20 balance".
 *   Again fine for the happy path.
 */
export async function snapshotSeasonYield(
  campaign: Address,
  seasonId: bigint,
): Promise<SnapshotResult> {
  const notes: string[] = [];

  // 1. Fetch campaign refs + positions for this season from the subgraph.
  const data = await gql<{
    campaign: SubgraphCampaignRef | null;
    positions: SubgraphPosition[];
  }>(
    `
    query Snapshot($campaign: ID!, $campaignBytes: Bytes!, $seasonId: BigInt!) {
      campaign(id: $campaign) {
        stakingVault
        yieldToken
      }
      positions(
        where: { campaign: $campaignBytes, seasonId: $seasonId, active: true }
        first: 1000
      ) {
        positionId
        user
        amount
        yieldClaimed
        active
        seasonId
      }
    }
    `,
    {
      campaign: campaign.toLowerCase(),
      campaignBytes: campaign.toLowerCase(),
      seasonId: seasonId.toString(),
    },
  );

  if (!data.campaign) {
    throw new Error(`Campaign ${campaign} not indexed by subgraph`);
  }

  const stakingVault = getAddress(data.campaign.stakingVault) as Address;
  const yieldToken = getAddress(data.campaign.yieldToken) as Address;

  if (data.positions.length === 0) {
    notes.push("No active positions found for this season.");
  }

  // 2. For each position, read `earned` live from the vault.
  const earnedCalls = data.positions.map((p) => ({
    address: stakingVault,
    abi: stakingVaultAbi,
    functionName: "earned" as const,
    args: [BigInt(p.positionId)] as const,
  }));

  let earnedResults: Array<{ status: string; result?: bigint; error?: Error }> = [];
  if (earnedCalls.length > 0) {
    earnedResults = (await client.multicall({
      contracts: earnedCalls,
      allowFailure: true,
    })) as typeof earnedResults;
  }

  // 3. Sum per-user.
  const perUser = new Map<string, bigint>();
  let totalYield = 0n;

  data.positions.forEach((pos, i) => {
    const earned = earnedResults[i]?.result ?? 0n;
    const claimed = BigInt(pos.yieldClaimed);
    const contribution = claimed + earned;
    if (contribution === 0n) return;

    const user = getAddress(pos.user);
    const key = user.toLowerCase();
    perUser.set(key, (perUser.get(key) ?? 0n) + contribution);
    totalYield += contribution;
  });

  const holders: SnapshotHolder[] = Array.from(perUser.entries())
    .map(([user, yieldAmount]) => ({
      user: getAddress(user) as Address,
      yieldAmount,
    }))
    .sort((a, b) =>
      b.yieldAmount === a.yieldAmount ? 0 : b.yieldAmount > a.yieldAmount ? 1 : -1,
    );

  // 4. Cross-check against the canonical on-chain value, if the season
  //    was started. Surface any mismatch as a note.
  let seasonTotalYieldOwed: bigint | null = null;
  try {
    seasonTotalYieldOwed = (await client.readContract({
      address: stakingVault,
      abi: stakingVaultAbi,
      functionName: "seasonTotalYieldOwed",
      args: [seasonId],
    })) as bigint;

    if (seasonTotalYieldOwed !== totalYield) {
      const delta = totalYield - seasonTotalYieldOwed;
      notes.push(
        `Snapshot totalYield (${totalYield}) differs from seasonTotalYieldOwed (${seasonTotalYieldOwed}) by ${delta}. ` +
          "If the season isn't ended yet the running total is expected to drift.",
      );
    }
  } catch {
    notes.push(
      "seasonTotalYieldOwed read failed — season may not exist on chain yet.",
    );
  }

  return {
    campaign,
    seasonId,
    stakingVault,
    yieldToken,
    totalYield,
    seasonTotalYieldOwed,
    holders,
    notes,
  };
}
