"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAccount, useReadContracts } from "wagmi";
import { formatUnits, type Address } from "viem";
import { useMemo } from "react";
import { useUserPortfolio, type UserPortfolio } from "@/lib/subgraph";
import { useCampaignMetadata } from "@/lib/metadata";
import { erc20Abi } from "@/contracts/erc20";

export default function Portfolio() {
  const t = useTranslations("portfolio");
  const tHome = useTranslations("home");
  const { address: user, isConnected } = useAccount();

  const { data: portfolio, isLoading } = useUserPortfolio(user);

  if (!isConnected) {
    return (
      <div className="max-w-7xl mx-auto px-8 pt-32 pb-24 text-center">
        <h1 className="text-4xl font-bold mb-3 text-on-surface">{t("title")}</h1>
        <p className="text-on-surface-variant mb-8">{t("connectWallet")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-8 pt-28 pb-20">
      <h1 className="text-4xl font-bold tracking-tight text-on-surface mb-2">
        {t("title")}
      </h1>
      <p className="text-on-surface-variant mb-10 font-mono text-sm">
        {user}
      </p>

      {isLoading && (
        <p className="text-on-surface-variant">{t("loading")}</p>
      )}

      {portfolio && (
        <>
          <Summary portfolio={portfolio} />
          <Section title={t("positionsTitle")}>
            {portfolio.positions.length === 0 ? (
              <EmptyState text={t("noPositions")} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {portfolio.positions.map((pos) => (
                  <PositionCard key={pos.id} position={pos} />
                ))}
              </div>
            )}
          </Section>

          <Section title={t("purchasesTitle")}>
            {portfolio.purchases.length === 0 ? (
              <EmptyState text={t("noPurchases")} />
            ) : (
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface-container-low">
                    <tr className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                      <th className="text-left px-6 py-3">
                        {t("col.campaign")}
                      </th>
                      <th className="text-right px-6 py-3">
                        {t("col.paid")}
                      </th>
                      <th className="text-right px-6 py-3">
                        {t("col.received")}
                      </th>
                      <th className="text-right px-6 py-3">
                        {t("col.date")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.purchases.map((p) => (
                      <tr
                        key={p.id}
                        className="border-t border-outline-variant/15"
                      >
                        <td className="px-6 py-3">
                          <Link
                            href={`/campaign/${p.campaign.id}`}
                            className="text-primary hover:underline font-mono text-xs"
                          >
                            {p.campaign.id.slice(0, 8)}…
                            {p.campaign.id.slice(-4)}
                          </Link>
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-xs">
                          {p.paymentToken.slice(0, 6)}…
                        </td>
                        <td className="px-6 py-3 text-right font-semibold text-on-surface">
                          {Number(
                            formatUnits(BigInt(p.campaignTokensOut), 18),
                          ).toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}{" "}
                          $CAMP
                        </td>
                        <td className="px-6 py-3 text-right text-on-surface-variant">
                          {new Date(
                            Number(p.timestamp) * 1000,
                          ).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title={t("claimsTitle")}>
            {portfolio.claims.length === 0 ? (
              <EmptyState text={t("noClaims")} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {portfolio.claims.map((c) => (
                  <ClaimCard key={c.id} claim={c} />
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2 className="text-xl font-bold text-on-surface mb-4">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-8 text-center text-sm text-on-surface-variant">
      {text}
    </div>
  );
}

function Summary({ portfolio }: { portfolio: UserPortfolio }) {
  const t = useTranslations("portfolio");

  const { totalPurchasedUSD, totalStaked, totalYieldClaimed, totalUsdcClaimable } =
    useMemo(() => {
      const toUsd = (tokens: string, pricePerToken: string) =>
        (BigInt(tokens) * BigInt(pricePerToken)) / 10n ** 18n;

      const purchased = portfolio.purchases.reduce(
        (acc, p) => acc + toUsd(p.campaignTokensOut, p.campaign.pricePerToken),
        0n,
      );

      const staked = portfolio.positions.reduce(
        (acc, pos) => acc + BigInt(pos.amount),
        0n,
      );

      const yieldClaimed = portfolio.positions.reduce(
        (acc, pos) => acc + BigInt(pos.yieldClaimed),
        0n,
      );

      // USDC claimable = pending USDC redemptions scaled by pro-rata deposits
      const usdcClaimable = portfolio.claims.reduce((acc, c) => {
        if (c.redemptionType !== "usdc") return acc;
        const owed = BigInt(c.usdcAmount);
        const deposited = BigInt(c.season.usdcDeposited);
        const totalOwed = BigInt(c.season.usdcOwed);
        if (owed === 0n || totalOwed === 0n) return acc;
        const entitled = (owed * deposited) / totalOwed;
        const claimed = BigInt(c.usdcClaimed);
        return acc + (entitled > claimed ? entitled - claimed : 0n);
      }, 0n);

      return {
        totalPurchasedUSD: purchased,
        totalStaked: staked,
        totalYieldClaimed: yieldClaimed,
        totalUsdcClaimable: usdcClaimable,
      };
    }, [portfolio]);

  const stats = [
    {
      label: t("summary.invested"),
      value: `$${Number(formatUnits(totalPurchasedUSD, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    },
    {
      label: t("summary.staked"),
      value: `${Number(formatUnits(totalStaked, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })} $CAMP`,
    },
    {
      label: t("summary.yieldClaimed"),
      value: `${Number(formatUnits(totalYieldClaimed, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })} $YIELD`,
      color: "text-primary",
    },
    {
      label: t("summary.usdcClaimable"),
      value: `$${Number(formatUnits(totalUsdcClaimable, 18)).toFixed(2)}`,
      color: "text-primary",
    },
  ];

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-8 mb-12 grid grid-cols-2 md:grid-cols-4 gap-8">
      {stats.map((s) => (
        <div key={s.label}>
          <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            {s.label}
          </div>
          <div className={`text-2xl font-bold ${s.color ?? "text-on-surface"}`}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function PositionCard({
  position,
}: {
  position: UserPortfolio["positions"][number];
}) {
  const t = useTranslations("portfolio");
  const { address: user } = useAccount();

  const { data: metadata } = useCampaignMetadata(
    position.campaign.metadataURI,
    position.campaign.metadataVersion,
  );

  // Read current earned + campaignToken balance for quick totals
  const { data: reads } = useReadContracts({
    contracts: user
      ? [
          {
            address: position.campaign.stakingVault as Address,
            abi: [
              {
                type: "function",
                name: "earned",
                stateMutability: "view",
                inputs: [{ type: "uint256" }],
                outputs: [{ type: "uint256" }],
              },
            ] as const,
            functionName: "earned",
            args: [BigInt(position.positionId)],
          },
          {
            address: position.campaign.campaignToken as Address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [user],
          },
        ]
      : [],
    query: { enabled: !!user, refetchInterval: 15_000 },
  });

  const earned = (reads?.[0]?.result as bigint) ?? 0n;
  const heldTokens = (reads?.[1]?.result as bigint) ?? 0n;

  return (
    <Link
      href={`/campaign/${position.campaign.id}`}
      className="block bg-surface-container-lowest rounded-2xl border border-outline-variant/15 overflow-hidden hover:-translate-y-1 transition-transform"
    >
      {metadata?.image && (
        <div className="h-32 bg-surface-container-low overflow-hidden">
          <img
            src={metadata.image}
            alt={metadata.name ?? ""}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-5">
        <h3 className="font-semibold text-on-surface mb-3 truncate">
          {metadata?.name ??
            `Campaign ${position.campaign.id.slice(0, 6)}…${position.campaign.id.slice(-4)}`}
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-on-surface-variant">
              {t("pos.position")}
            </div>
            <div className="font-semibold text-on-surface">
              #{position.positionId}
            </div>
          </div>
          <div>
            <div className="text-xs text-on-surface-variant">
              {t("pos.staked")}
            </div>
            <div className="font-semibold text-on-surface">
              {Number(formatUnits(BigInt(position.amount), 18)).toLocaleString(
                undefined,
                { maximumFractionDigits: 2 },
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-on-surface-variant">
              {t("pos.earnedNow")}
            </div>
            <div className="font-semibold text-primary">
              {Number(formatUnits(earned, 18)).toFixed(4)} $YIELD
            </div>
          </div>
          <div>
            <div className="text-xs text-on-surface-variant">
              {t("pos.heldOutside")}
            </div>
            <div className="font-semibold text-on-surface">
              {Number(formatUnits(heldTokens, 18)).toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ClaimCard({ claim }: { claim: UserPortfolio["claims"][number] }) {
  const t = useTranslations("portfolio");

  const owed = BigInt(claim.usdcAmount);
  const deposited = BigInt(claim.season.usdcDeposited);
  const totalOwed = BigInt(claim.season.usdcOwed);
  const entitled =
    totalOwed > 0n && deposited > 0n ? (owed * deposited) / totalOwed : 0n;
  const claimed = BigInt(claim.usdcClaimed);
  const claimable = entitled > claimed ? entitled - claimed : 0n;

  return (
    <Link
      href={`/campaign/${claim.campaign.id}`}
      className="block bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-5 hover:-translate-y-1 transition-transform"
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-on-surface-variant">
            {t("claim.season", { id: claim.season.seasonId })}
          </div>
          <div className="font-mono text-xs text-on-surface mt-0.5">
            {claim.campaign.id.slice(0, 8)}…{claim.campaign.id.slice(-4)}
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
            claim.redemptionType === "product"
              ? "bg-secondary-container text-white"
              : "bg-primary-fixed text-on-primary-fixed-variant"
          }`}
        >
          {claim.redemptionType}
        </span>
      </div>
      {claim.redemptionType === "usdc" ? (
        <div className="grid grid-cols-2 gap-3 text-sm pt-3 border-t border-outline-variant/15">
          <div>
            <div className="text-xs text-on-surface-variant">
              {t("claim.burned")}
            </div>
            <div className="font-semibold text-on-surface">
              {Number(formatUnits(BigInt(claim.yieldBurned), 18)).toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-on-surface-variant">
              {t("claim.claimable")}
            </div>
            <div className="font-semibold text-primary">
              ${Number(formatUnits(claimable, 18)).toFixed(2)}
            </div>
          </div>
        </div>
      ) : (
        <div className="pt-3 border-t border-outline-variant/15 text-sm">
          <div className="text-xs text-on-surface-variant">
            {t("claim.productAmount")}
          </div>
          <div className="font-semibold text-primary">
            {Number(formatUnits(BigInt(claim.productAmount), 18)).toLocaleString(
              undefined,
              { maximumFractionDigits: 2 },
            )}{" "}
            units
          </div>
        </div>
      )}
    </Link>
  );
}
