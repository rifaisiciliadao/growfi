"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAccount, useDisconnect, useReadContract, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { useTxNotify } from "@/lib/useTxNotify";
import {
  useSubgraphProducer,
  useProducerCampaigns,
  useProducerIndexed,
  useUserPortfolio,
  isSocialVerificationActive,
  SOCIAL_VERIFICATION_ENABLED,
  type SubgraphCampaign,
  type SubgraphProducer,
  type UserPortfolio,
} from "@/lib/subgraph";
import {
  useProducerProfile,
  useResolvedCampaignMetadata,
} from "@/lib/metadata";
import { uploadImage, uploadProducerProfile } from "@/lib/api";
import { abis, getAddresses } from "@/contracts";
import { Spinner } from "@/components/Spinner";
import { ProducerAggregateDashboard } from "@/components/ProducerAggregateDashboard";
import { NotificationsSection } from "@/components/NotificationsSection";
import { SocialVerificationBadge } from "@/components/SocialVerificationBadge";
import { SocialVerificationPanel } from "@/components/SocialVerificationPanel";
import { useEnsName } from "@/lib/ens";
import { waitForTx } from "@/lib/waitForTx";
import { getProtocolLabel, protocolInitials } from "@/lib/protocolLabels";

export default function ProducerPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: raw } = use(params);
  const t = useTranslations("grower");
  const { address: connected } = useAccount();
  const { producerRegistry } = getAddresses();

  const producerAddress = (raw?.toLowerCase() ?? "") as Address;
  const isValid = /^0x[a-fA-F0-9]{40}$/.test(producerAddress);
  const isSelfProfile =
    !!connected && connected.toLowerCase() === producerAddress.toLowerCase();
  const protocolLabel = getProtocolLabel(producerAddress);

  const { data: producer, isLoading: producerLoading } = useSubgraphProducer(
    isValid ? producerAddress : undefined,
  );
  const { data: profile, isLoading: profileLoading } = useProducerProfile(
    producer?.profileURI,
    producer?.version,
  );
  const { data: campaigns, isLoading: campaignsLoading } =
    useProducerCampaigns(isValid ? producerAddress : undefined);
  const { data: portfolio, isLoading: portfolioLoading } = useUserPortfolio(
    isValid ? producerAddress : undefined,
  );
  // ENS reverse-lookup against mainnet — cheap, cached. Used as the
  // display name when there's no internal profile but the wallet has a
  // public ENS identity (e.g. turinglabs.eth). Social verification is NOT
  // promoted by ENS; only the on-chain social attestation triggers the badge.
  const { data: ensName } = useEnsName(isValid ? producerAddress : undefined);
  const { data: onchainSocialActive } = useReadContract({
    address: producerRegistry,
    abi: abis.ProducerRegistry as never,
    functionName: "hasActiveSocialAttestation",
    args: [producerAddress],
    query: {
      enabled: SOCIAL_VERIFICATION_ENABLED && isValid && !protocolLabel,
      refetchInterval: 20_000,
    },
  }) as { data: boolean | undefined };

  /**
   * While the subgraph+JSON is loading we don't know yet whether the
   * producer has a profile — showing "anonymous" immediately would be
   * misleading. Only flip that switch once we've actually fetched and
   * gotten nothing back.
   */
  const profileLoadingCombined =
    producerLoading || (!!producer?.profileURI && profileLoading);
  const displayName =
    protocolLabel || profile?.name || ensName || t("anonymous");
  const showCampaignsSection = campaignsLoading || Boolean(campaigns?.length);

  const [editing, setEditing] = useState(false);

  if (!isValid) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-32 text-center">
        <p className="text-on-surface-variant">{t("invalidAddress")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 md:px-8 md:pt-8">
      <section className="mb-8 md:mb-10">
        <div className="relative h-44 overflow-hidden rounded-2xl bg-surface-container-low md:h-60">
          {profile?.cover ? (
            <img
              src={profile.cover}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <ProfileCoverPlaceholder />
          )}

          {isSelfProfile && !editing && !profileLoadingCombined && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={t("editProfile")}
              title={t("editProfile")}
              className="app-control absolute right-3 top-3 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/70 bg-white/90 text-on-surface shadow-[0_14px_36px_-24px_rgba(14,35,17,0.75)] backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 md:right-4 md:top-4"
            >
              <PencilIcon />
            </button>
          )}
        </div>

        <div className="relative z-10 -mt-10 mx-4 flex min-w-0 items-center gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest/95 p-3 shadow-[0_20px_48px_-34px_rgba(14,35,17,0.65)] backdrop-blur-md md:-mt-12 md:ml-6 md:mr-auto md:w-fit md:max-w-[calc(100%-3rem)] md:pr-6">
          {profile?.avatar ? (
            <img
              src={profile.avatar}
              alt={profile.name ?? ""}
              className="h-20 w-20 shrink-0 rounded-full border-4 border-surface object-cover shadow-[0_16px_38px_-24px_rgba(14,35,17,0.6)] md:h-24 md:w-24"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-surface bg-primary-fixed text-2xl font-bold text-on-primary-fixed-variant shadow-[0_16px_38px_-24px_rgba(14,35,17,0.6)] md:h-24 md:w-24">
              {protocolLabel
                ? protocolInitials(protocolLabel)
                : (profile?.name ?? producerAddress).slice(2, 4).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-on-surface break-words flex items-center gap-2 flex-wrap">
              {profileLoadingCombined ? (
                <span className="inline-block h-8 w-48 rounded-md bg-surface-container-high animate-pulse" />
              ) : (
                <>
                  <span className="break-words">
                    {displayName}
                  </span>
                  <SocialVerificationBadge
                    verified={
                      protocolLabel
                        ? false
                        : isSocialVerificationActive(producer) ||
                          Boolean(onchainSocialActive)
                    }
                    size={20}
                  />
                </>
              )}
            </h1>
            <p className="text-xs md:text-sm text-on-surface-variant font-mono break-all">
              {producerAddress}
            </p>
            <SocialProfileLinks
              producer={producer}
              active={
                !protocolLabel &&
                (isSocialVerificationActive(producer) || Boolean(onchainSocialActive))
              }
            />
            {profile?.location && (
              <p className="text-sm text-on-surface-variant mt-1">
                📍 {profile.location}
              </p>
            )}
          </div>
        </div>
      </section>

      {profile?.bio && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-6 mb-10">
          <p className="text-sm text-on-surface leading-relaxed whitespace-pre-line">
            {profile.bio}
          </p>
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-3 text-primary text-sm hover:underline"
            >
              {profile.website} →
            </a>
          )}
        </div>
      )}

      {profileLoadingCombined ? (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-8 mb-10">
          <div className="space-y-3">
            <div className="h-4 w-3/4 rounded bg-surface-container-high animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-surface-container-high animate-pulse" />
          </div>
        </div>
      ) : (
        !profile &&
        !protocolLabel &&
        !editing && (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-8 mb-10 text-center">
            <p className="text-sm font-semibold text-on-surface">
              {t("noProfileYet")}
            </p>
            <p className="mt-2 text-sm text-on-surface-variant">
              {isSelfProfile ? t("profileSelfHint") : t("profileConnectHint")}
            </p>
            {isSelfProfile && (
              <button
                onClick={() => setEditing(true)}
                className="mt-5 inline-flex items-center justify-center bg-primary text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition"
              >
                {t("createProfile")}
              </button>
            )}
          </div>
        )
      )}

      {editing && (
        <ProfileForm
          onDone={() => setEditing(false)}
          current={profile}
          producerAddress={producerAddress}
          previousVersion={producer?.version}
          producer={producer}
          socialCampaignAddress={campaigns?.[0]?.id as Address | undefined}
          showSocialVerification={
            SOCIAL_VERIFICATION_ENABLED && !protocolLabel && Boolean(campaigns?.[0]?.id)
          }
        />
      )}

      {isSelfProfile && <NotificationsSection address={producerAddress} />}

      {isSelfProfile && <DisconnectLink />}

      {isSelfProfile && (
        <ProducerAggregateDashboard producerAddress={producerAddress} />
      )}

      {showCampaignsSection && (
        <section className="mb-12">
          <h2 className="text-xl font-bold text-on-surface mb-4">
            {t("campaignsTitle")}
          </h2>
          {campaignsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 overflow-hidden"
                >
                  <div className="h-32 bg-surface-container-high animate-pulse" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 w-2/3 rounded bg-surface-container-high animate-pulse" />
                    <div className="h-3 w-1/3 rounded bg-surface-container-high animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {campaigns?.map((c) => (
                <CampaignThumb key={c.id} campaign={c} />
              ))}
            </div>
          )}
        </section>
      )}

      <WalletExposure
        portfolio={portfolio}
        isLoading={portfolioLoading}
      />
    </div>
  );
}

function ProfileCoverPlaceholder() {
  return (
    <div
      className="relative h-full w-full overflow-hidden bg-gradient-to-br from-primary/20 via-primary-fixed/30 to-secondary/20"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1200 320"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full text-primary/20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M-40 260C150 115 285 390 470 225S790 45 1240 205" />
        <path d="M-60 300C135 155 300 430 500 265S820 85 1260 245" />
        <path d="M130-20C250 95 215 205 335 340" />
        <path d="M940-30C845 90 905 210 795 350" />
      </svg>
      <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full border border-white/40 bg-white/20" />
      <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full border border-white/40 bg-white/20" />
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function WalletExposure({
  portfolio,
  isLoading,
}: {
  portfolio: UserPortfolio | undefined;
  isLoading: boolean;
}) {
  const t = useTranslations("grower.wallet");
  const { investments, staking, totals } = useMemo(() => {
    const investmentMap = new Map<string, InvestmentAggregate>();
    const stakingMap = new Map<string, StakingAggregate>();

    for (const purchase of portfolio?.purchases ?? []) {
      const current = investmentMap.get(purchase.campaign.id);
      const tokens = BigInt(purchase.campaignTokensOut);
      const value = (tokens * BigInt(purchase.campaign.pricePerToken || "0")) / 10n ** 18n;
      const timestamp = Number(purchase.timestamp);
      if (current) {
        current.tokens += tokens;
        current.value += value;
        current.count += 1;
        current.lastTimestamp = Math.max(current.lastTimestamp, timestamp);
      } else {
        investmentMap.set(purchase.campaign.id, {
          campaign: purchase.campaign,
          tokens,
          value,
          count: 1,
          lastTimestamp: timestamp,
        });
      }
    }

    for (const position of portfolio?.positions ?? []) {
      const current = stakingMap.get(position.campaign.id);
      const amount = BigInt(position.amount);
      if (current) {
        current.amount += amount;
        current.count += 1;
        current.seasons.add(position.seasonId);
      } else {
        stakingMap.set(position.campaign.id, {
          campaign: position.campaign,
          amount,
          count: 1,
          seasons: new Set([position.seasonId]),
        });
      }
    }

    const investments = Array.from(investmentMap.values()).sort((a, b) =>
      b.value > a.value ? 1 : b.value < a.value ? -1 : 0,
    );
    const staking = Array.from(stakingMap.values()).sort((a, b) =>
      b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0,
    );

    return {
      investments,
      staking,
      totals: {
        invested: investments.reduce((sum, item) => sum + item.value, 0n),
        staked: staking.reduce((sum, item) => sum + item.amount, 0n),
      },
    };
  }, [portfolio]);

  return (
    <section className="mb-12">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            {t("eyebrow")}
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-on-surface">
            {t("title")}
          </h2>
        </div>
        {!isLoading && (
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-on-surface-variant">
            <span className="rounded-full border border-outline-variant/15 bg-surface-container-lowest px-3 py-1.5">
              {t("investedTotal", { value: formatUsd18(totals.invested) })}
            </span>
            <span className="rounded-full border border-outline-variant/15 bg-surface-container-lowest px-3 py-1.5">
              {t("stakedTotal", { value: formatTokenAmount(totals.staked) })}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ExposurePane
          title={t("investmentsTitle")}
          subtitle={t("investmentsSubtitle")}
          isLoading={isLoading}
          empty={t("noInvestments")}
        >
          {investments.map((investment) => (
            <InvestmentCard key={investment.campaign.id} investment={investment} />
          ))}
        </ExposurePane>

        <ExposurePane
          title={t("stakingTitle")}
          subtitle={t("stakingSubtitle")}
          isLoading={isLoading}
          empty={t("noStaking")}
        >
          {staking.map((stake) => (
            <StakingCard key={stake.campaign.id} stake={stake} />
          ))}
        </ExposurePane>
      </div>
    </section>
  );
}

function ExposurePane({
  title,
  subtitle,
  isLoading,
  empty,
  children,
}: {
  title: string;
  subtitle: string;
  isLoading: boolean;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  const hasItems = Array.isArray(items) ? items.length > 0 : Boolean(items);

  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-[0_24px_70px_-58px_rgba(14,35,17,0.55)]">
      <div className="mb-4">
        <h3 className="text-base font-bold tracking-[-0.02em] text-on-surface">
          {title}
        </h3>
        <p className="mt-1 text-xs leading-5 text-on-surface-variant">
          {subtitle}
        </p>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-surface-container-high"
            />
          ))}
        </div>
      ) : hasItems ? (
        <div className="space-y-3">{children}</div>
      ) : (
        <div className="rounded-xl bg-surface-container-low px-4 py-6 text-center text-sm text-on-surface-variant">
          {empty}
        </div>
      )}
    </div>
  );
}

interface InvestmentAggregate {
  campaign: UserPortfolio["purchases"][number]["campaign"];
  tokens: bigint;
  value: bigint;
  count: number;
  lastTimestamp: number;
}

interface StakingAggregate {
  campaign: UserPortfolio["positions"][number]["campaign"];
  amount: bigint;
  count: number;
  seasons: Set<string>;
}

function InvestmentCard({
  investment,
}: {
  investment: InvestmentAggregate;
}) {
  const t = useTranslations("grower.wallet");
  const { data: meta } = useResolvedCampaignMetadata(
    investment.campaign.id,
    investment.campaign.metadataURI,
    investment.campaign.metadataVersion,
  );

  return (
    <Link
      href={`/campaign/${investment.campaign.id}`}
      className="block rounded-xl border border-outline-variant/15 bg-surface-container-low p-4 transition hover:-translate-y-0.5 hover:bg-surface-container-high"
    >
      <ExposureCardHeader
        image={meta?.image}
        name={meta?.name || shortCampaign(investment.campaign.id)}
        state={investment.campaign.state}
      />
      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <MiniMetric label={t("value")} value={formatUsd18(investment.value)} />
        <MiniMetric label={t("tokens")} value={formatTokenAmount(investment.tokens)} />
        <MiniMetric label={t("buys")} value={String(investment.count)} />
      </div>
      <div className="mt-3 text-xs text-on-surface-variant">
        {t("lastBuy", {
          date: new Date(investment.lastTimestamp * 1000).toLocaleDateString(),
        })}
      </div>
    </Link>
  );
}

function StakingCard({ stake }: { stake: StakingAggregate }) {
  const t = useTranslations("grower.wallet");
  const { data: meta } = useResolvedCampaignMetadata(
    stake.campaign.id,
    stake.campaign.metadataURI,
    stake.campaign.metadataVersion,
  );
  const seasons = Array.from(stake.seasons)
    .sort((a, b) => Number(a) - Number(b))
    .join(", ");

  return (
    <Link
      href={`/campaign/${stake.campaign.id}?tab=stake`}
      className="block rounded-xl border border-outline-variant/15 bg-surface-container-low p-4 transition hover:-translate-y-0.5 hover:bg-surface-container-high"
    >
      <ExposureCardHeader
        image={meta?.image}
        name={meta?.name || shortCampaign(stake.campaign.id)}
        state={stake.campaign.state}
      />
      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <MiniMetric label={t("staked")} value={formatTokenAmount(stake.amount)} />
        <MiniMetric label={t("positions")} value={String(stake.count)} />
        <MiniMetric label={t("seasons")} value={seasons || "—"} />
      </div>
    </Link>
  );
}

function ExposureCardHeader({
  image,
  name,
  state,
}: {
  image?: string | null;
  name: string;
  state: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {image ? (
        <img
          src={image}
          alt=""
          className="h-12 w-12 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="h-12 w-12 shrink-0 rounded-xl bg-primary-fixed" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-on-surface">
          {name}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            {state}
          </span>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-sm font-bold text-on-surface">
        {value}
      </div>
    </div>
  );
}

function shortCampaign(address: string) {
  return `Campaign ${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatTokenAmount(value: bigint) {
  const amount = Number(formatUnits(value, 18));
  return amount.toLocaleString(undefined, {
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  });
}

function formatUsd18(value: bigint) {
  const amount = Number(formatUnits(value, 18));
  return `$${amount.toLocaleString(undefined, {
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  })}`;
}

function SocialProfileLinks({
  producer,
  active,
}: {
  producer: SubgraphProducer | null | undefined;
  active: boolean;
}) {
  const t = useTranslations("grower.social");
  if (!active || !producer) return null;

  const link = socialProfileLink(producer);
  if (!link) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <a
        href={link.href}
        target="_blank"
        rel="noreferrer"
        title={t("verifiedProfileLink", { handle: link.label })}
        aria-label={t("verifiedProfileLink", { handle: link.label })}
        className="inline-flex h-8 max-w-full items-center gap-2 rounded-full border border-primary/[0.15] bg-primary/[0.08] px-3 text-xs font-semibold text-primary transition hover:border-primary/[0.3] hover:bg-primary/[0.12] focus:outline-none focus:ring-2 focus:ring-primary/[0.3]"
      >
        <SocialPlatformIcon platform={producer.socialPlatform} />
        <span className="truncate">{link.label}</span>
        <ExternalIcon />
      </a>
    </div>
  );
}

function socialProfileLink(producer: SubgraphProducer): { href: string; label: string } | null {
  const rawHandle = producer.socialHandle?.trim();
  const cleanHandle = rawHandle?.replace(/^@+/, "");
  const label = cleanHandle ? `@${cleanHandle}` : producer.socialPlatform?.trim();
  if (!label) return null;

  const profileUrl = normalizeSocialUrl(producer.socialProfileUrl);
  if (profileUrl) return { href: profileUrl, label };

  const platform = producer.socialPlatform?.toLowerCase().trim();
  if ((platform === "x" || platform === "twitter") && cleanHandle) {
    return {
      href: `https://x.com/${encodeURIComponent(cleanHandle)}`,
      label,
    };
  }

  const proofUrl = normalizeSocialUrl(producer.socialProofUrl);
  return proofUrl ? { href: proofUrl, label } : null;
}

function normalizeSocialUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function SocialPlatformIcon({ platform }: { platform: string | null | undefined }) {
  const normalized = platform?.toLowerCase().trim();
  if (normalized === "x" || normalized === "twitter") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className="shrink-0"
      >
        <path d="M17.53 3h3.31l-7.24 8.27L22.12 21h-6.67l-5.22-6.82L4.25 21H.94l7.74-8.85L.5 3h6.84l4.72 6.24L17.53 3Zm-1.16 16.28h1.83L6.34 4.63H4.37l12 14.65Z" />
      </svg>
    );
  }
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.8 3.8 5.8 3.8 9S14.5 18.2 12 21" />
      <path d="M12 3C9.5 5.8 8.2 8.8 8.2 12S9.5 18.2 12 21" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 opacity-70"
    >
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </svg>
  );
}

function DisconnectLink() {
  const t = useTranslations("grower");
  const { disconnect } = useDisconnect();
  return (
    <div className="text-right mb-10 -mt-6">
      <button
        onClick={() => disconnect()}
        className="text-xs text-on-surface-variant hover:text-error transition-colors underline-offset-4 hover:underline"
      >
        {t("disconnect")}
      </button>
    </div>
  );
}

function CampaignThumb({ campaign }: { campaign: SubgraphCampaign }) {
  const { data: meta } = useResolvedCampaignMetadata(
    campaign.id,
    campaign.metadataURI,
    campaign.metadataVersion,
  );
  return (
    <Link
      href={`/campaign/${campaign.id}`}
      className="block bg-surface-container-lowest rounded-2xl border border-outline-variant/15 overflow-hidden hover:-translate-y-1 transition-transform"
    >
      {meta?.image && (
        <div
          className="h-32 bg-surface-container-low bg-cover bg-center"
          style={{ backgroundImage: `url('${meta.image}')` }}
        />
      )}
      <div className="p-4">
        <div className="font-semibold text-on-surface truncate">
          {meta?.name || `Campaign ${campaign.id.slice(0, 8)}…`}
        </div>
        <div className="text-xs text-on-surface-variant mt-1">
          {campaign.state}
        </div>
      </div>
    </Link>
  );
}

function ProfileForm({
  current,
  onDone,
  producerAddress,
  previousVersion,
  producer,
  socialCampaignAddress,
  showSocialVerification,
}: {
  current?: { name?: string; bio?: string; avatar?: string | null; cover?: string | null; website?: string | null; location?: string | null } | null;
  onDone: () => void;
  producerAddress: Address;
  /** Subgraph version at the moment the form opened. Undefined if the producer has no profile yet. */
  previousVersion: string | undefined;
  producer: SubgraphProducer | null | undefined;
  socialCampaignAddress: Address | undefined;
  showSocialVerification: boolean;
}) {
  const t = useTranslations("grower.form");
  const { producerRegistry } = getAddresses();
  const queryClient = useQueryClient();

  const [name, setName] = useState(current?.name ?? "");
  const [bio, setBio] = useState(current?.bio ?? "");
  const [website, setWebsite] = useState(current?.website ?? "");
  const [location, setLocation] = useState(current?.location ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(current?.avatar ?? null);
  const [coverUrl, setCoverUrl] = useState<string | null>(current?.cover ?? null);

  const [busy, setBusy] = useState<
    null | "uploading" | "profile" | "sig" | "chain" | "indexing"
  >(null);
  const [error, setError] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();
  const tx = useTranslations("tx");
  const notify = useTxNotify();

  const pollEnabled = busy === "indexing";
  const indexed = useProducerIndexed(
    producerAddress,
    previousVersion,
    pollEnabled,
  );

  useEffect(() => {
    if (!pollEnabled || !indexed.data) return;
    // Subgraph caught up — invalidate the parent's producer query so the
    // page re-renders with the new name/avatar, then close the form.
    queryClient.invalidateQueries({
      queryKey: ["subgraph", "producer", producerAddress.toLowerCase()],
    });
    onDone();
  }, [pollEnabled, indexed.data, queryClient, producerAddress, onDone]);

  const handleImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setUrl: (u: string | null) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setBusy("uploading");
      const up = await uploadImage(file);
      setUrl(up.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async () => {
    setError(null);
    try {
      setBusy("profile");
      const profile = await uploadProducerProfile({
        name,
        bio,
        avatar: avatarUrl,
        cover: coverUrl,
        website: website || null,
        location: location || null,
      });
      setBusy("sig");
      const hash = await writeContractAsync({
        address: producerRegistry,
        abi: abis.ProducerRegistry as never,
        functionName: "setProfile",
        args: [profile.url],
      });
      setBusy("chain");
      const r = await waitForTx(hash);
      if (r.status !== "success") throw new Error("setProfile reverted");
      // Now wait for subgraph to index the new version
      setBusy("indexing");
      notify.success(tx("setProfileConfirmed"), hash);
    } catch (err) {
      setBusy(null);
      const msg = err instanceof Error ? err.message : String(err);
      if (!/user (rejected|denied)/i.test(msg)) {
        setError(msg);
        notify.error(tx("setProfileFailed"), err);
      }
    }
  };

  return (
    <>
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-6 mb-6 space-y-4">
        <h3 className="font-semibold text-on-surface mb-2">{t("title")}</h3>

        <Field label={t("name")}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder={t("namePlaceholder")}
          />
        </Field>

        <Field label={t("bio")}>
          <textarea
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="input"
            placeholder={t("bioPlaceholder")}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t("avatar")}>
            {avatarUrl && (
              <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover mb-2" />
            )}
            <input type="file" accept="image/*" onChange={(e) => handleImage(e, setAvatarUrl)} className="text-sm" />
          </Field>
          <Field label={t("cover")}>
            {coverUrl && (
              <img src={coverUrl} alt="" className="w-full h-20 rounded-lg object-cover mb-2" />
            )}
            <input type="file" accept="image/*" onChange={(e) => handleImage(e, setCoverUrl)} className="text-sm" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t("location")}>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="input"
              placeholder={t("locationPlaceholder")}
            />
          </Field>
          <Field label={t("website")}>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="input"
              placeholder="https://"
            />
          </Field>
        </div>

        {error && (
          <div className="bg-red-50 text-error border border-red-200 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onDone}
            disabled={busy !== null}
            className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!name || busy !== null}
            className="regen-gradient text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
          >
            {busy !== null && <Spinner size={14} />}
            {busy === "uploading"
              ? t("uploading")
              : busy === "profile"
                ? t("savingJson")
                : busy === "sig"
                  ? t("awaitingSignature")
                  : busy === "chain"
                    ? t("confirmingTx")
                    : busy === "indexing"
                      ? t("indexing")
                      : t("save")}
          </button>
        </div>

        <style jsx global>{`
          .input {
            width: 100%;
            padding: 0.625rem 0.875rem;
            background: var(--color-surface-container-low);
            border: 1px solid rgb(189 202 186 / 0.15);
            border-radius: 0.625rem;
            color: var(--color-on-surface);
            font-size: 0.875rem;
            outline: none;
            transition: all 0.15s;
          }
          .input:focus {
            border-color: var(--color-primary);
          }
        `}</style>
      </div>

      {showSocialVerification && socialCampaignAddress && (
        <SocialVerificationPanel
          producerAddress={producerAddress}
          campaignAddress={socialCampaignAddress}
          producer={producer}
        />
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
