"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatUnits } from "viem";
import {
  CampaignCard,
  CampaignCardSkeleton,
  type CampaignState,
} from "@/components/CampaignCard";
import { useSubgraphCampaigns, type SubgraphCampaign } from "@/lib/subgraph";

type Filter = "all" | "funding" | "active" | "closed";

const FILTERS: Filter[] = ["all", "funding", "active", "closed"];

function toCampaignState(state: SubgraphCampaign["state"]): CampaignState {
  if (state === "Active") return "active";
  if (state === "Ended" || state === "Buyback") return "ended";
  return "funding";
}

function progressOf(campaign: SubgraphCampaign) {
  const cap = BigInt(campaign.maxCap);
  if (cap === 0n) return 0;
  const pct = Number((BigInt(campaign.currentSupply) * 10_000n) / cap) / 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function yieldRateOf(campaign: SubgraphCampaign) {
  const value = Number(formatUnits(BigInt(campaign.currentYieldRate), 18));
  return Number.isFinite(value) ? value : 0;
}

function deadlineOf(campaign: SubgraphCampaign) {
  const timestamp = Number(campaign.fundingDeadline) * 1000;
  const days = Math.ceil((timestamp - Date.now()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function totalRaisedOf(campaigns: SubgraphCampaign[]) {
  return campaigns.reduce((sum, campaign) => {
    return sum + Number(formatUnits(BigInt(campaign.totalRaised), 18));
  }, 0);
}

export default function CampaignsPage() {
  const t = useTranslations("landing.campaigns");
  const [filter, setFilter] = useState<Filter>("all");
  const { data: campaigns, isLoading, isError } = useSubgraphCampaigns();

  const visibleCampaigns = useMemo(() => {
    const list = campaigns ?? [];
    if (filter === "all") return list;
    if (filter === "closed") {
      return list.filter((campaign) => toCampaignState(campaign.state) === "ended");
    }
    return list.filter((campaign) => toCampaignState(campaign.state) === filter);
  }, [campaigns, filter]);
  const totalRaised = totalRaisedOf(campaigns ?? []);
  const activeCount = (campaigns ?? []).filter(
    (campaign) => toCampaignState(campaign.state) === "active",
  ).length;

  return (
    <div className="min-h-screen bg-surface">
      <section className="mx-auto max-w-7xl px-6 pb-8 pt-16 md:px-8 md:pb-12 md:pt-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_0.55fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t("kicker")}
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl font-extrabold leading-[0.94] tracking-[-0.065em] text-on-surface sm:text-6xl md:text-7xl">
              {t("title1")}
              <br />
              {t("title2")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-on-surface-variant">
              {t("intro")}
            </p>
          </div>

          <div className="app-card grid grid-cols-3 rounded-[1.35rem] p-5 text-center">
            <div>
              <div className="font-mono text-2xl font-bold tabular-nums text-on-surface">
                {(campaigns ?? []).length}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                {t("filters.all")}
              </div>
            </div>
            <div className="border-x border-outline-variant/25">
              <div className="font-mono text-2xl font-bold tabular-nums text-on-surface">
                {activeCount}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                {t("stateLabel.active")}
              </div>
            </div>
            <div>
              <div className="font-mono text-2xl font-bold tabular-nums text-on-surface">
                ${Math.round(totalRaised).toLocaleString()}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                Raised
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-y border-outline-variant/25 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((key) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`app-control rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.13em] ${
                    active
                      ? "bg-on-surface text-white"
                      : "bg-white/75 text-on-surface-variant hover:bg-white hover:text-on-surface"
                  }`}
                >
                  {t(`filters.${key}`)}
                </button>
              );
            })}
          </div>

          <Link
            href="/"
            className="app-control inline-flex items-center justify-center rounded-full border border-outline-variant/35 bg-white/75 px-5 py-2.5 text-sm font-bold text-on-surface hover:bg-white"
          >
            Back to home
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24 md:px-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <CampaignCardSkeleton />
            <CampaignCardSkeleton />
            <CampaignCardSkeleton />
          </div>
        ) : isError ? (
          <div className="app-card rounded-[1.35rem] p-8 text-center text-on-surface-variant">
            Campaigns could not be loaded right now.
          </div>
        ) : visibleCampaigns.length === 0 ? (
          <div className="app-card rounded-[1.35rem] p-8 text-center text-on-surface-variant">
            No campaigns in this category yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                address={campaign.id}
                name={`Campaign ${campaign.id.slice(0, 8)}...`}
                producer={campaign.producer}
                location=""
                image="/investors-olive-hero.jpg"
                campaignTokenAddress={campaign.campaignToken}
                state={toCampaignState(campaign.state)}
                progress={progressOf(campaign)}
                yieldRate={yieldRateOf(campaign)}
                deadline={deadlineOf(campaign)}
                stakedTokens={Number(formatUnits(BigInt(campaign.totalStaked), 18))}
                metadataURI={campaign.metadataURI}
                metadataVersion={campaign.metadataVersion}
              />
            ))}
          </div>
        )}

        <div className="app-card mt-10 flex flex-col gap-5 rounded-[1.35rem] p-6 md:flex-row md:items-center md:justify-between md:p-7">
          <div>
            <h2 className="text-xl font-bold tracking-[-0.035em] text-on-surface">
              {t("createTitle")}
            </h2>
            <p className="mt-2 max-w-2xl text-base leading-7 text-on-surface-variant">
              {t("createBody")}
            </p>
          </div>
          <Link
            href="/create"
            className="app-control inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-on-surface px-6 text-sm font-bold text-white hover:bg-black"
          >
            {t("createCta")}
          </Link>
        </div>
      </section>
    </div>
  );
}
