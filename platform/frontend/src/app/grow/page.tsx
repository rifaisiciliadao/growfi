"use client";

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
        functionName: "markupBps",
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
  const markupBps = (reads?.[3]?.result as bigint | undefined) ?? 1_000n;
  const effectiveReferencePrice =
    (reads?.[4]?.result as bigint | undefined) ?? 0n;
  const displayFloor = floor > 0n ? floor : effectiveReferencePrice;
  const circulating = totalSupply > treasuryGrow ? totalSupply - treasuryGrow : 0n;
  const salePrice =
    displayFloor > 0n ? (displayFloor * (10_000n + markupBps)) / 10_000n : 0n;
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
          <div className="space-y-6">
            <DirectBuyGrowPanel />
            <BondingCurve
              floor={displayFloor}
              salePrice={salePrice}
              markupBps={markupBps}
              circulating={circulating}
            />
          </div>
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

type CurvePoint = {
  salePrice: bigint;
};

function BondingCurve({
  floor,
  salePrice,
  markupBps,
  circulating,
}: {
  floor: bigint;
  salePrice: bigint;
  markupBps: bigint;
  circulating: bigint;
}) {
  const t = useTranslations("grow.curve");
  const points = buildCurvePoints(floor, markupBps, circulating);
  const chartPoints = points.map((point, index) => ({
    ...point,
    x: points.length === 1 ? 0 : (index / (points.length - 1)) * 100,
    yValue: Number(formatUnits(point.salePrice, 18)),
  }));
  const prices = chartPoints.map((point) => point.yValue);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = Math.max(maxPrice - minPrice, 0.000001);
  const path = chartPoints
    .map((point, index) => {
      const y = 100 - ((point.yValue - minPrice) / priceRange) * 82 - 9;
      return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <section className="overflow-hidden rounded-[8px] border border-zinc-200 bg-white p-5 shadow-[0_24px_70px_-55px_rgba(15,23,42,0.45)] md:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
        {t("eyebrow")}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
        {t("title")}
      </h2>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <CurveMetric label={t("live")} value={formatUsd18(salePrice)} />
        <CurveMetric
          label={t("markup")}
          value={`${(Number(markupBps) / 100).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })}%`}
        />
        <CurveMetric
          label={t("floor")}
          value={floor === 0n ? "—" : formatUsd18(floor)}
        />
        <CurveMetric
          label={t("supply")}
          value={formatWholeGrow(circulating)}
        />
      </div>

      <div className="mt-5">
        {floor === 0n || circulating === 0n ? (
          <div className="flex min-h-[180px] items-center justify-center rounded-[8px] border border-dashed border-zinc-300 bg-zinc-50 px-4 text-center text-sm text-zinc-500">
            {t("empty")}
          </div>
        ) : (
          <div className="relative h-[180px] rounded-[8px] border border-emerald-950/10 bg-[#071510] p-4">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="h-full w-full overflow-visible"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="grow-curve-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`${path} L 100 100 L 0 100 Z`}
                fill="url(#grow-curve-fill)"
              />
              <path
                d={path}
                fill="none"
                stroke="#6ee7b7"
                strokeLinecap="round"
                strokeWidth="2.4"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="pointer-events-none absolute left-4 top-4 text-[10px] font-mono uppercase tracking-[0.16em] text-emerald-50/55">
              {t("live")}
            </div>
          </div>
        )}
      </div>
    </section>
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

function CurveMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-zinc-200 bg-[#f7f9f4] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-semibold text-zinc-950">
        {value}
      </div>
    </div>
  );
}

function buildCurvePoints(
  floor: bigint,
  markupBps: bigint,
  circulating: bigint,
): CurvePoint[] {
  const cumulativeUsd = [0n, 100n, 250n, 500n, 1_000n, 2_500n].map(
    (value) => value * 10n ** 18n,
  );
  if (floor === 0n || circulating === 0n) {
    return cumulativeUsd.map(() => ({ salePrice: 0n }));
  }

  let backing = (floor * circulating) / 10n ** 18n;
  let supply = circulating;
  let consumed = 0n;

  return cumulativeUsd.map((target) => {
    const delta = target - consumed;
    if (delta > 0n && supply > 0n) {
      const currentFloor = (backing * 10n ** 18n) / supply;
      const currentSalePrice =
        (currentFloor * (10_000n + markupBps)) / 10_000n;
      if (currentSalePrice > 0n) {
        const minted = (delta * 10n ** 18n) / currentSalePrice;
        backing += delta;
        supply += minted;
      }
      consumed = target;
    }

    const projectedFloor = supply > 0n ? (backing * 10n ** 18n) / supply : 0n;
    const projectedSalePrice =
      (projectedFloor * (10_000n + markupBps)) / 10_000n;

    return {
      salePrice: projectedSalePrice,
    };
  });
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
