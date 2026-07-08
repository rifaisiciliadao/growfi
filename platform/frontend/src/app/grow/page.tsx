"use client";

import { useMemo, useState } from "react";
import { useReadContracts } from "wagmi";
import { formatUnits, type Address } from "viem";
import { useTranslations } from "next-intl";
import { abis, CHAIN_ID, getAddresses } from "@/contracts";
import { erc20Abi } from "@/contracts/erc20";
import { DirectBuyGrowPanel } from "@/components/DirectBuyGrowPanel";
import { EscrowClaimPanel } from "@/components/EscrowClaimPanel";
import { GrowStakingPanel } from "@/components/GrowStakingPanel";
import { Flywheel } from "@/components/grow/Flywheel";
import {
  useGrowTreasuryStakingAllocations,
  useSubgraphCampaigns,
  type SubgraphCampaign,
  type GrowTreasuryStakingAllocation,
} from "@/lib/subgraph";
import { useResolvedCampaignMetadata } from "@/lib/metadata";

const treasuryAbi = abis.GrowTreasury as never;
const tokenAbi = abis.GrowToken as never;
const WAGMI_CHAIN_ID = CHAIN_ID as never;
type ActionTab = "buy" | "stake" | "earn";

export default function GrowDashboard() {
  const t = useTranslations("grow");
  const a = getAddresses();
  const enabled = Boolean(a.growToken && a.growTreasury);
  const [activeTab, setActiveTab] = useState<ActionTab>("buy");

  const { data: reads } = useReadContracts({
    query: { enabled, refetchInterval: 15_000 },
    contracts: [
      {
        abi: treasuryAbi,
        address: a.growTreasury as Address,
        chainId: WAGMI_CHAIN_ID,
        functionName: "intrinsicFloorPrice",
      },
      {
        abi: tokenAbi,
        address: a.growToken as Address,
        chainId: WAGMI_CHAIN_ID,
        functionName: "totalSupply",
      },
      {
        abi: tokenAbi,
        address: a.growToken as Address,
        chainId: WAGMI_CHAIN_ID,
        functionName: "balanceOf",
        args: [a.growTreasury as Address],
      },
      {
        abi: tokenAbi,
        address: a.growToken as Address,
        chainId: WAGMI_CHAIN_ID,
        functionName: "effectiveReferencePrice",
      },
    ],
  });

  const floor = (reads?.[0]?.result as bigint | undefined) ?? 0n;
  const totalSupply = (reads?.[1]?.result as bigint | undefined) ?? 0n;
  const treasuryGrow = (reads?.[2]?.result as bigint | undefined) ?? 0n;
  const effectiveReferencePrice =
    (reads?.[3]?.result as bigint | undefined) ?? 0n;
  const displayFloor = floor > 0n ? floor : effectiveReferencePrice;
  const circulating = totalSupply > treasuryGrow ? totalSupply - treasuryGrow : 0n;
  const stats = [
    {
      label: t("floorPrice"),
      value: displayFloor === 0n ? "—" : formatUsd18(displayFloor),
      hint: t("floorHint"),
    },
    {
      label: t("circulating"),
      value: formatWholeGrow(circulating),
      hint: t("circulatingHint", {
        total: formatWholeGrow(totalSupply),
      }),
    },
    ...(treasuryGrow > 0n
      ? [
          {
            label: t("treasuryHolds"),
            value: formatWholeGrow(treasuryGrow),
            hint: t("treasuryHoldsHint"),
          },
        ]
      : []),
  ];
  const actionTabs: Array<{ id: ActionTab; label: string }> = [
    { id: "buy", label: t("actions.tabs.buy") },
    { id: "stake", label: t("actions.tabs.stake") },
    { id: "earn", label: t("actions.tabs.earn") },
  ];

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-8 md:px-8 md:pt-12">
        <section className="grid gap-7 pb-7 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.48fr)] lg:items-center">
          <header>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              GrowFi Protocol
            </p>
            <h1 className="mt-3 text-5xl font-extrabold leading-[0.95] tracking-[-0.065em] text-on-surface sm:text-6xl md:text-7xl">
              {t("title")}
            </h1>
            <p className="mt-4 max-w-2xl text-lg font-medium leading-8 text-on-surface-variant">
              {t("subtitle")}
            </p>
          </header>

          <aside className="app-card rounded-[1.35rem] p-4 md:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t("overview")}
            </p>
            <div className="mt-3 grid gap-3">
              {stats.map((stat) => (
                <Stat
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  hint={stat.hint}
                />
              ))}
            </div>
          </aside>
        </section>

        <section>
          <div className="mb-4 inline-flex max-w-full gap-1 rounded-full border border-outline-variant/30 bg-white/75 p-1 shadow-[0_18px_60px_-50px_rgba(14,35,17,0.65)] backdrop-blur-xl">
            {actionTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-10 rounded-full px-5 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-on-surface text-white shadow-[0_12px_30px_-22px_rgba(0,0,0,0.7)]"
                    : "text-on-surface-variant hover:bg-white hover:text-on-surface"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-stretch">
            <div className="min-w-0">
              {activeTab === "buy" && <DirectBuyGrowPanel />}
              {activeTab === "stake" && <GrowStakingPanel />}
              {activeTab === "earn" && <EscrowClaimPanel />}
            </div>
            <aside className="min-w-0">
              <GrowTreasuryOwnershipCard treasury={a.growTreasury} />
            </aside>
          </div>
        </section>

        <Flywheel />
      </div>
    </div>
  );
}

function GrowTreasuryOwnershipCard({
  treasury,
}: {
  treasury?: string;
}) {
  const t = useTranslations("grow.stakingAllocation");
  const [page, setPage] = useState(0);
  const { data: campaigns, isLoading: campaignsLoading } = useSubgraphCampaigns();
  const { data: stakingAllocations, isLoading: stakingLoading } =
    useGrowTreasuryStakingAllocations(
      treasury,
      100,
    );

  const balanceContracts = useMemo(
    () => {
      if (!treasury) return [];
      return (campaigns ?? []).map((campaign) => ({
        abi: erc20Abi,
        address: campaign.campaignToken as Address,
        chainId: WAGMI_CHAIN_ID,
        functionName: "balanceOf",
        args: [treasury as Address],
      }));
    },
    [campaigns, treasury],
  );

  const { data: balanceReads, isLoading: balancesLoading } = useReadContracts({
    contracts: balanceContracts,
    query: {
      enabled: Boolean(treasury && balanceContracts.length > 0),
      refetchInterval: 15_000,
    },
  });

  const ownership = useMemo(
    () =>
      buildTreasuryOwnership(
        campaigns ?? [],
        stakingAllocations ?? [],
        balanceReads,
      ),
    [campaigns, stakingAllocations, balanceReads],
  );
  const isLoading = campaignsLoading || stakingLoading || balancesLoading;
  const pageSize = 4;
  const pageCount = Math.max(1, Math.ceil(ownership.holdings.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * pageSize;
  const visibleHoldings = ownership.holdings.slice(
    pageStart,
    pageStart + pageSize,
  );
  const pageEnd = Math.min(pageStart + visibleHoldings.length, ownership.holdings.length);

  return (
    <section className="app-card flex h-full min-h-[34rem] flex-col rounded-[1.35rem] p-4 md:p-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          {t("eyebrow")}
        </p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-[-0.04em] text-on-surface">
              {t("title")}
            </h2>
            <p className="mt-1 text-xs font-medium leading-5 text-on-surface-variant">
              {t("subtitle")}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
              {t("total")}
            </div>
            <div className="mt-0.5 font-mono text-xl font-bold text-on-surface">
              {ownership.totalOwned > 0n
                ? formatGrowAmount(ownership.totalOwned)
                : "—"}
            </div>
          </div>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <AllocationMetric
          label={t("value")}
          value={ownership.totalValue > 0n ? formatUsd18Compact(ownership.totalValue) : "—"}
        />
        <AllocationMetric
          label={t("stakedPercent")}
          value={ownership.totalOwned > 0n ? formatPercent(ownership.stakedShare) : "—"}
        />
      </div>

      <div className="mt-3 flex flex-1 flex-col rounded-[1rem] border border-outline-variant/18 bg-surface-container-low p-2">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-surface-container"
              />
            ))}
          </div>
        ) : visibleHoldings.length === 0 || ownership.totalBasis === 0n ? (
          <div className="rounded-xl bg-surface-container px-4 py-6 text-center text-sm font-medium text-on-surface-variant">
            {t("empty")}
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-2">
              {visibleHoldings.map((holding) => (
                <GrowTreasuryOwnershipRow
                  key={holding.campaign.id}
                  holding={holding}
                  totalBasis={ownership.totalBasis}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-outline-variant/15 pt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
              <span>
                {t("page", {
                  from: ownership.holdings.length === 0 ? 0 : pageStart + 1,
                  to: pageEnd,
                  total: ownership.holdings.length,
                })}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  disabled={safePage === 0}
                  className="rounded-full border border-outline-variant/20 px-2 py-1 text-on-surface transition hover:bg-surface-container-high disabled:opacity-35"
                >
                  {t("previous")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) => Math.min(pageCount - 1, current + 1))
                  }
                  disabled={safePage >= pageCount - 1}
                  className="rounded-full border border-outline-variant/20 px-2 py-1 text-on-surface transition hover:bg-surface-container-high disabled:opacity-35"
                >
                  {t("next")}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function AllocationMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tracking-[-0.04em] text-on-surface">
        {value}
      </div>
    </div>
  );
}

interface TreasuryCampaignHolding {
  campaign: SubgraphCampaign;
  direct: bigint;
  staked: bigint;
  owned: bigint;
  value: bigint;
  basis: bigint;
}

function buildTreasuryOwnership(
  campaigns: SubgraphCampaign[],
  stakingAllocations: GrowTreasuryStakingAllocation[],
  balanceReads:
    | readonly { result?: unknown; status?: string }[]
    | undefined,
) {
  const stakedByCampaign = new Map<string, bigint>();
  for (const allocation of stakingAllocations) {
    stakedByCampaign.set(
      allocation.campaign.id.toLowerCase(),
      BigInt(allocation.amount),
    );
  }

  const holdings = campaigns
    .map((campaign, index): TreasuryCampaignHolding => {
      const direct =
        balanceReads?.[index]?.status === "success"
          ? ((balanceReads[index].result as bigint | undefined) ?? 0n)
          : 0n;
      const staked = stakedByCampaign.get(campaign.id.toLowerCase()) ?? 0n;
      const owned = direct + staked;
      const pricePerToken = BigInt(campaign.pricePerToken || "0");
      const value = (owned * pricePerToken) / 10n ** 18n;
      return {
        campaign,
        direct,
        staked,
        owned,
        value,
        basis: value > 0n ? value : owned,
      };
    })
    .filter((holding) => holding.owned > 0n)
    .sort((a, b) => {
      if (a.basis === b.basis) return 0;
      return b.basis > a.basis ? 1 : -1;
    });

  const totalOwned = holdings.reduce((sum, holding) => sum + holding.owned, 0n);
  const totalStaked = holdings.reduce((sum, holding) => sum + holding.staked, 0n);
  const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0n);
  const totalBasis = holdings.reduce((sum, holding) => sum + holding.basis, 0n);
  const stakedShare =
    totalOwned > 0n ? Number((totalStaked * 10_000n) / totalOwned) / 100 : 0;

  return {
    holdings,
    totalOwned,
    totalStaked,
    totalValue,
    totalBasis,
    stakedShare,
  };
}

function GrowTreasuryOwnershipRow({
  holding,
  totalBasis,
}: {
  holding: TreasuryCampaignHolding;
  totalBasis: bigint;
}) {
  const t = useTranslations("grow.stakingAllocation");
  const { data: metadata } = useResolvedCampaignMetadata(
    holding.campaign.id,
    holding.campaign.metadataURI,
    holding.campaign.metadataVersion,
  );
  const share =
    totalBasis > 0n ? Number((holding.basis * 10_000n) / totalBasis) / 100 : 0;
  const width = Math.max(2, Math.min(100, share));
  const name =
    metadata?.name ||
    `Campaign ${holding.campaign.id.slice(0, 6)}...${holding.campaign.id.slice(-4)}`;

  return (
    <article className="overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold tracking-[-0.02em] text-on-surface">
            {name}
          </div>
          <div className="mt-1 text-xs font-medium leading-5 text-on-surface-variant">
            {t("owned", { amount: formatGrowAmount(holding.owned) })}
            {holding.staked > 0n && (
              <span className="text-on-surface-variant/75">
                {" · "}
                {t("staked", { amount: formatGrowAmount(holding.staked) })}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-bold text-primary">
            {formatPercent(share)}
          </div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
            {holding.value > 0n ? formatUsd18Compact(holding.value) : holding.campaign.state}
          </div>
        </div>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-container">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${width}%` }}
        />
      </div>
    </article>
  );
}

function formatUsd18Compact(value: bigint) {
  if (value === 0n) return "—";
  const amount = Number(formatUnits(value, 18));
  return `$${amount.toLocaleString(undefined, {
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  })}`;
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low px-4 py-3.5">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold tracking-[-0.04em] text-on-surface">{value}</div>
      {hint && <div className="mt-1.5 text-xs leading-5 text-on-surface-variant">{hint}</div>}
    </div>
  );
}

function formatUsd18(value: bigint) {
  if (value === 0n) return "—";
  const amount = Number(formatUnits(value, 18));
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })}`;
}

function formatWholeGrow(value: bigint) {
  return Number(formatUnits(value, 18)).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

function formatGrowAmount(value: bigint) {
  const amount = Number(formatUnits(value, 18));
  return amount.toLocaleString(undefined, {
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  });
}

function formatPercent(value: number) {
  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  })}%`;
}
