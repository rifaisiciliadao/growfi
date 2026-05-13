"use client";

import { useReadContracts } from "wagmi";
import { formatUnits, type Address } from "viem";
import { useTranslations } from "next-intl";
import { abis, getAddresses } from "@/contracts";
import { DirectBuyGrowPanel } from "@/components/DirectBuyGrowPanel";
import { EscrowClaimPanel } from "@/components/EscrowClaimPanel";
import { GrowStakingPanel } from "@/components/GrowStakingPanel";
import { Flywheel } from "@/components/grow/Flywheel";

const treasuryAbi = abis.GrowTreasury as never;
const tokenAbi = abis.GrowToken as never;

export default function GrowDashboard() {
  const t = useTranslations("grow");
  const a = getAddresses();
  const enabled = Boolean(a.growToken && a.growTreasury);

  const { data: reads } = useReadContracts({
    query: { enabled, refetchInterval: 15_000 },
    contracts: [
      {
        abi: treasuryAbi,
        address: a.growTreasury as Address,
        functionName: "intrinsicFloorPrice",
      },
      {
        abi: tokenAbi,
        address: a.growToken as Address,
        functionName: "totalSupply",
      },
      {
        abi: tokenAbi,
        address: a.growToken as Address,
        functionName: "balanceOf",
        args: [a.growTreasury as Address],
      },
    ],
  });

  const floor = (reads?.[0]?.result as bigint | undefined) ?? 0n;
  const totalSupply = (reads?.[1]?.result as bigint | undefined) ?? 0n;
  const treasuryGrow = (reads?.[2]?.result as bigint | undefined) ?? 0n;
  const circulating = totalSupply > treasuryGrow ? totalSupply - treasuryGrow : 0n;
  const stats = [
    {
      label: t("floorPrice"),
      value: floor === 0n ? "—" : formatUsd18(floor),
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

  return (
    <div className="bg-[#f7f9f4]">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 md:px-8 md:pt-12">
        <section className="overflow-hidden rounded-[8px] border border-emerald-950/10 bg-[#06140f] shadow-[0_30px_80px_-50px_rgba(6,20,15,0.65)]">
          <div className="grid gap-8 p-5 md:p-8 lg:grid-cols-[1.2fr_1fr] lg:p-10">
            <header className="flex min-h-[260px] flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
                  GrowFi Protocol
                </p>
                <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white md:text-6xl">
                  {t("title")}
                </h1>
                <p className="mt-5 max-w-2xl text-sm leading-6 text-emerald-50/75 md:text-base">
                  {t("subtitle")}
                </p>
              </div>
              <div className="mt-8 h-px w-full bg-gradient-to-r from-emerald-300/70 via-white/15 to-transparent" />
            </header>

            <div
              className={`grid content-end gap-3 ${
                stats.length === 3 ? "sm:grid-cols-3 lg:grid-cols-1" : "sm:grid-cols-2"
              }`}
            >
              {stats.map((stat) => (
                <Stat
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  hint={stat.hint}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <DirectBuyGrowPanel />
          <GrowStakingPanel />
          <div className="lg:col-span-2">
            <EscrowClaimPanel />
          </div>
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
    <div className="rounded-[8px] border border-white/10 bg-white/[0.06] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/60">
        {label}
      </div>
      <div className="mt-2 font-mono text-2xl text-white">{value}</div>
      {hint && <div className="mt-2 text-[11px] leading-4 text-emerald-50/55">{hint}</div>}
    </div>
  );
}

function formatUsd18(value: bigint) {
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
