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
