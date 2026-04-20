"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatUnits } from "viem";
import { useProducerAggregate } from "@/lib/subgraph";
import { RefreshButton } from "./RefreshButton";

/**
 * Producer-only cross-campaign summary, rendered at the top of the
 * /producer/[address] page when the viewer is the producer themselves.
 *
 * Pulls every campaign + season through a single aggregate subgraph
 * query and computes three KPIs the producer cares about most:
 *
 *   - USDC outstanding: sum of (usdcOwed - usdcDeposited) across all
 *     reported seasons → "you still owe X USDC to holders".
 *   - Seasons pending report: count of seasons ended but not reported.
 *   - Total raised / active campaigns: quick health snapshot.
 *
 * Each stat is clickable (where applicable) and deep-links to the
 * relevant campaign's Manage tab so the producer can act immediately.
 */
export function ProducerAggregateDashboard({
  producerAddress,
}: {
  producerAddress: string;
}) {
  const t = useTranslations("producer.dashboard");
  const { data, isLoading, refetch } = useProducerAggregate(producerAddress);

  const stats = useMemo(() => {
    if (!data) {
      return {
        campaignCount: 0,
        activeCampaigns: 0,
        totalRaisedUsd: 0n,
        usdcOutstanding18: 0n,
        seasonsPendingReport: 0,
        pendingReportLinks: [] as Array<{ campaign: string; seasonId: string }>,
        campaignsWithShortfall: [] as Array<{
          campaign: string;
          outstanding18: bigint;
        }>,
      };
    }

    let totalRaisedUsd = 0n;
    let usdcOutstanding18 = 0n;
    let seasonsPendingReport = 0;
    let activeCampaigns = 0;
    const pendingReportLinks: Array<{ campaign: string; seasonId: string }> =
      [];
    const campaignShortfallMap = new Map<string, bigint>();

    for (const c of data.campaigns) {
      if (c.state === "Active" || c.state === "Funding") activeCampaigns++;
      // totalRaised on the subgraph is 18-dec USD internal scale.
      totalRaisedUsd += BigInt(c.totalRaised);

      for (const s of c.seasons) {
        const owed = BigInt(s.usdcOwed);
        const deposited = BigInt(s.usdcDeposited);
        if (s.reported && owed > deposited) {
          const shortfall = owed - deposited;
          usdcOutstanding18 += shortfall;
          campaignShortfallMap.set(
            c.id,
            (campaignShortfallMap.get(c.id) ?? 0n) + shortfall,
          );
        }
        if (!s.active && !s.reported) {
          seasonsPendingReport++;
          pendingReportLinks.push({ campaign: c.id, seasonId: s.seasonId });
        }
      }
    }

    const campaignsWithShortfall = Array.from(
      campaignShortfallMap.entries(),
    ).map(([campaign, outstanding18]) => ({ campaign, outstanding18 }));

    return {
      campaignCount: data.campaigns.length,
      activeCampaigns,
      totalRaisedUsd,
      usdcOutstanding18,
      seasonsPendingReport,
      pendingReportLinks,
      campaignsWithShortfall,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-6 mb-8">
        <div className="space-y-3">
          <div className="h-4 w-1/3 rounded bg-surface-container-high animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-2/3 rounded bg-surface-container-high animate-pulse" />
                <div className="h-6 w-1/2 rounded bg-surface-container-high animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.campaigns.length === 0) {
    return null;
  }

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-6 mb-8">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">
          {t("title")}
        </h2>
        <RefreshButton onClick={() => refetch()} label={t("refresh")} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <Stat
          label={t("campaigns")}
          value={stats.campaignCount.toString()}
          hint={t("activeOf", { active: stats.activeCampaigns })}
        />
        <Stat
          label={t("totalRaised")}
          value={`€${Number(
            formatUnits(stats.totalRaisedUsd, 18),
          ).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        />
        <Stat
          label={t("outstandingUsdc")}
          value={`$${Number(
            formatUnits(stats.usdcOutstanding18, 18),
          ).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          highlight={stats.usdcOutstanding18 > 0n}
          hint={
            stats.campaignsWithShortfall.length > 0
              ? t("acrossCampaigns", {
                  count: stats.campaignsWithShortfall.length,
                })
              : t("allSettled")
          }
        />
        <Stat
          label={t("seasonsPendingReport")}
          value={stats.seasonsPendingReport.toString()}
          highlight={stats.seasonsPendingReport > 0}
          hint={
            stats.seasonsPendingReport > 0 ? t("reportNeeded") : t("upToDate")
          }
        />
      </div>

      {/* Deep links to actionable items */}
      {(stats.pendingReportLinks.length > 0 ||
        stats.campaignsWithShortfall.length > 0) && (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-outline-variant/15">
          {stats.pendingReportLinks.slice(0, 3).map((link) => (
            <Link
              key={`${link.campaign}-${link.seasonId}`}
              href={`/campaign/${link.campaign}?tab=manage`}
              className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-amber-100 transition"
            >
              {t("reportLink", { seasonId: link.seasonId })} →
            </Link>
          ))}
          {stats.campaignsWithShortfall.slice(0, 3).map((link) => (
            <Link
              key={link.campaign}
              href={`/campaign/${link.campaign}?tab=manage`}
              className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-error rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-red-100 transition"
            >
              {t("depositLink", {
                amount: Number(
                  formatUnits(link.outstanding18, 18),
                ).toLocaleString(undefined, { maximumFractionDigits: 0 }),
              })}{" "}
              →
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
        {label}
      </div>
      <div
        className={`text-2xl font-bold ${
          highlight ? "text-error" : "text-on-surface"
        }`}
      >
        {value}
      </div>
      {hint && (
        <div className="text-[11px] text-on-surface-variant mt-0.5">{hint}</div>
      )}
    </div>
  );
}
