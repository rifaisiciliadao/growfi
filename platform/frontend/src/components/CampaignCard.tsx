"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { erc20Abi, type Address } from "viem";
import { useReadContract } from "wagmi";
import { useResolvedCampaignMetadata } from "@/lib/metadata";
import { CampaignImage } from "./CampaignImage";

export type CampaignState = "funding" | "active" | "ended";

export interface CampaignCardProps {
  address: string;
  /** Fallback name if metadata isn't available (e.g. truncated address). */
  name: string;
  producer: string;
  location: string;
  /** Fallback image if metadata isn't available. */
  image: string;
  campaignTokenAddress?: string;
  state: CampaignState;
  progress: number;
  yieldRate: number;
  deadline?: string;
  stakedTokens?: number;
  /** Optional on-chain pointer to off-chain JSON (set via CampaignRegistry). */
  metadataURI?: string | null;
  metadataVersion?: string | number | null;
}

const stateConfig: Record<
  CampaignState,
  { bg: string; text: string; progressColor: string; yieldColor: string }
> = {
  funding: {
    bg: "bg-primary-fixed",
    text: "text-on-primary-fixed-variant",
    progressColor: "bg-primary",
    yieldColor: "text-primary",
  },
  active: {
    bg: "bg-secondary-container",
    text: "text-white",
    progressColor: "bg-secondary",
    yieldColor: "text-secondary",
  },
  ended: {
    bg: "bg-surface-variant",
    text: "text-on-surface-variant",
    progressColor: "bg-outline",
    yieldColor: "text-on-surface-variant",
  },
};

export function CampaignCard({
  address,
  name,
  image,
  campaignTokenAddress,
  state,
  progress,
  yieldRate,
  deadline,
  stakedTokens,
  metadataURI,
  metadataVersion,
}: CampaignCardProps) {
  const t = useTranslations("home");
  const cfg = stateConfig[state];
  const isEnded = state === "ended";

  const { data: metadata } = useResolvedCampaignMetadata(
    address,
    metadataURI,
    metadataVersion,
  );

  const resolvedName = metadata?.name || name;
  const resolvedImage = metadata?.image || image || null;
  const resolvedLocation = metadata?.location;
  const { data: campaignTokenSymbol } = useReadContract({
    address: campaignTokenAddress as Address | undefined,
    abi: erc20Abi,
    functionName: "symbol",
    query: {
      enabled: Boolean(campaignTokenAddress),
      staleTime: Infinity,
      refetchInterval: false,
    },
  });
  const tokenSymbol = campaignTokenSymbol ?? "CAMPAIGN";
  const stakedTokensLabel =
    stakedTokens !== undefined
      ? stakedTokens.toLocaleString(undefined, {
          maximumFractionDigits: stakedTokens >= 100 ? 0 : 2,
        })
      : null;

  return (
    <Link href={`/campaign/${address}`} className="block group">
      <article className="app-card overflow-hidden rounded-[1.35rem] transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_34px_90px_-54px_rgba(14,35,17,0.62)]">
        <div className="relative h-56 overflow-hidden bg-surface-container-low">
          {isEnded && (
            <div className="absolute inset-0 bg-surface-variant/40 z-10 mix-blend-multiply" />
          )}
          <div
            className={`w-full h-full group-hover:scale-105 transition-transform duration-500 ${isEnded ? "grayscale" : ""}`}
          >
            <CampaignImage src={resolvedImage} alt={resolvedName} />
          </div>
          <div
            className={`absolute left-4 top-4 ${cfg.bg} ${cfg.text} rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] shadow-sm backdrop-blur-md ${isEnded ? "z-20" : ""}`}
          >
            {t(`state.${state}`)}
          </div>
        </div>

        <div className="p-5 md:p-6">
          <h3 className="text-lg font-bold leading-tight tracking-[-0.03em] text-on-surface">
            {resolvedName}
          </h3>
          {resolvedLocation && (
            <p className="mt-1 text-xs font-medium text-on-surface-variant">
              {resolvedLocation}
            </p>
          )}
          {!resolvedLocation && <div className="mt-1 h-4" />}

          <div className="mt-5 space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                <span>{t("card.progress")}</span>
                <span className="font-mono tabular-nums">{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className={`h-full ${cfg.progressColor} rounded-full transition-all duration-700`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex items-end justify-between border-t border-outline-variant/15 pt-4">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                {isEnded ? t("card.status") : t("card.expectedYield")}
              </span>
              <span className={`font-mono text-2xl font-bold leading-none tabular-nums ${cfg.yieldColor}`}>
                {isEnded ? t("card.completed") : `${yieldRate}x`}
              </span>
            </div>

            {!isEnded && (
              <div className="min-h-4 text-xs font-medium text-on-surface-variant">
                {state === "funding" &&
                  deadline &&
                  t("card.deadline", { days: deadline })}
                {state === "active" &&
                  stakedTokensLabel &&
                  t("card.stakedTokens", {
                    amount: stakedTokensLabel,
                    symbol: tokenSymbol,
                  })}
              </div>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

/**
 * Skeleton placeholder with the same footprint as CampaignCard, rendered
 * while the subgraph query is in flight. Keeps the page from jumping when
 * the data finally arrives.
 */
export function CampaignCardSkeleton() {
  return (
    <div className="app-card overflow-hidden rounded-[1.35rem]">
      <div className="h-56 bg-surface-container-low animate-pulse" />
      <div className="p-6 space-y-4">
        <div className="h-4 w-3/4 bg-surface-container-low rounded animate-pulse" />
        <div className="h-3 w-1/2 bg-surface-container-low rounded animate-pulse" />
        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-xs">
            <div className="h-3 w-16 bg-surface-container-low rounded animate-pulse" />
            <div className="h-3 w-10 bg-surface-container-low rounded animate-pulse" />
          </div>
          <div className="h-1 bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-surface-container-low animate-pulse" />
          </div>
        </div>
        <div className="flex justify-between items-center pt-4 border-t border-outline-variant/15">
          <div className="h-3 w-20 bg-surface-container-low rounded animate-pulse" />
          <div className="h-4 w-12 bg-surface-container-low rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
