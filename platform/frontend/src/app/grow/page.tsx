"use client";

import { useState } from "react";
import { useReadContracts } from "wagmi";
import { formatUnits, type Address } from "viem";
import { useTranslations } from "next-intl";
import { abis, CHAIN_ID, getAddresses } from "@/contracts";
import { DirectBuyGrowPanel } from "@/components/DirectBuyGrowPanel";
import { EscrowClaimPanel } from "@/components/EscrowClaimPanel";
import { GrowStakingPanel } from "@/components/GrowStakingPanel";
import { Flywheel } from "@/components/grow/Flywheel";
import {
  useGrowTreasuryStakingAllocations,
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
        <section className="grid gap-7 pb-7 lg:grid-cols-[0.92fr_0.48fr] lg:items-center">
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

        <GrowStakingAllocationSection treasury={a.growTreasury} />

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

          {activeTab === "buy" && <DirectBuyGrowPanel />}
          {activeTab === "stake" && <GrowStakingPanel />}
          {activeTab === "earn" && <EscrowClaimPanel />}
        </section>

        <Flywheel />
      </div>
    </div>
  );
}

function GrowStakingAllocationSection({
  treasury,
}: {
  treasury?: string;
}) {
  const t = useTranslations("grow.stakingAllocation");
  const { data: allocations, isLoading } = useGrowTreasuryStakingAllocations(
    treasury,
    12,
  );
  const totalStaked = (allocations ?? []).reduce(
    (sum, allocation) => sum + BigInt(allocation.amount),
    0n,
  );
  const largest = (allocations ?? []).reduce(
    (max, allocation) =>
      BigInt(allocation.amount) > max ? BigInt(allocation.amount) : max,
    0n,
  );
  const largestShare =
    totalStaked > 0n ? Number((largest * 10_000n) / totalStaked) / 100 : 0;

  return (
    <section className="mb-7 rounded-[1.35rem] border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-[0_28px_80px_-58px_rgba(14,35,17,0.55)] md:p-6">
      <div className="grid gap-6 lg:grid-cols-[0.72fr_1fr] lg:items-start">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-extrabold leading-[0.98] tracking-[-0.055em] text-on-surface md:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-on-surface-variant md:text-base">
            {t("subtitle")}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <AllocationMetric
              label={t("total")}
              value={totalStaked > 0n ? formatGrowAmount(totalStaked) : "—"}
            />
            <AllocationMetric
              label={t("largest")}
              value={totalStaked > 0n ? `${formatPercent(largestShare)}` : "—"}
            />
          </div>
        </header>

        <div className="rounded-[1rem] border border-outline-variant/18 bg-surface-container-low p-3">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-xl bg-surface-container"
                />
              ))}
            </div>
          ) : !allocations || allocations.length === 0 || totalStaked === 0n ? (
            <div className="rounded-xl bg-surface-container px-4 py-8 text-center text-sm font-medium text-on-surface-variant">
              {t("empty")}
            </div>
          ) : (
            <div className="space-y-2">
              {allocations.map((allocation) => (
                <GrowStakingAllocationRow
                  key={allocation.campaign.id}
                  allocation={allocation}
                  totalStaked={totalStaked}
                />
              ))}
            </div>
          )}
        </div>
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

function GrowStakingAllocationRow({
  allocation,
  totalStaked,
}: {
  allocation: GrowTreasuryStakingAllocation;
  totalStaked: bigint;
}) {
  const t = useTranslations("grow.stakingAllocation");
  const { data: metadata } = useResolvedCampaignMetadata(
    allocation.campaign.id,
    allocation.campaign.metadataURI,
    allocation.campaign.metadataVersion,
  );
  const amount = BigInt(allocation.amount);
  const share = totalStaked > 0n ? Number((amount * 10_000n) / totalStaked) / 100 : 0;
  const width = Math.max(2, Math.min(100, share));
  const name =
    metadata?.name ||
    `Campaign ${allocation.campaign.id.slice(0, 6)}...${allocation.campaign.id.slice(-4)}`;

  return (
    <article className="overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold tracking-[-0.02em] text-on-surface">
            {name}
          </div>
          <div className="mt-1 text-xs font-medium text-on-surface-variant">
            {t("staked", { amount: formatGrowAmount(amount) })}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-bold text-primary">
            {formatPercent(share)}
          </div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
            {allocation.campaign.state}
          </div>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-container">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${width}%` }}
        />
      </div>
    </article>
  );
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
