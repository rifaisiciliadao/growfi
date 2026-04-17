"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits, type Address } from "viem";
import { abis } from "@/contracts";
import { erc20Abi } from "@/contracts/erc20";
import { useCampaignSeasons, type SubgraphSeason } from "@/lib/subgraph";
import { fetchMerkleProof } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

interface Props {
  campaignAddress: Address;
  harvestManager: Address;
  yieldToken: Address;
}

const harvestAbi = abis.HarvestManager as never;

export function HarvestPanel({
  campaignAddress,
  harvestManager,
  yieldToken,
}: Props) {
  const t = useTranslations("detail.harvest");
  const { address: user, isConnected } = useAccount();

  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>();
  const [pendingKind, setPendingKind] = useState<
    "approve" | "redeem" | "claim" | null
  >(null);

  const { writeContractAsync } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: pendingHash });

  // Subgraph: list of seasons
  const { data: seasons, refetch: refetchSeasons } =
    useCampaignSeasons(campaignAddress);

  // User's YIELD balance
  const { data: yieldBalanceRaw, refetch: refetchBalance } = useReadContract({
    address: yieldToken,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: user ? [user] : undefined,
    query: { enabled: !!user, refetchInterval: 15_000 },
  }) as { data: bigint | undefined; refetch: () => void };
  const yieldBalance = yieldBalanceRaw ?? 0n;

  useEffect(() => {
    if (!receipt.isSuccess || !pendingHash) return;
    void refetchSeasons();
    void refetchBalance();
    setPendingKind(null);
    setPendingHash(undefined);
  }, [receipt.isSuccess, pendingHash, refetchSeasons, refetchBalance]);

  const runTx = async (
    kind: typeof pendingKind,
    call: Promise<`0x${string}`>,
  ) => {
    try {
      setPendingKind(kind);
      const hash = await call;
      setPendingHash(hash);
    } catch (err) {
      setPendingKind(null);
      console.error(err);
    }
  };

  const reportedSeasons = (seasons ?? []).filter((s) => s.reported);

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/15">
      <h2 className="text-2xl font-bold tracking-tight text-on-surface mb-2">
        {t("title")}
      </h2>
      <p className="text-sm text-on-surface-variant mb-6">{t("subtitle")}</p>

      {/* User balance */}
      <div className="bg-surface-container-low rounded-xl p-5 mb-6 border border-outline-variant/15">
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            {t("yourBalance")}
          </span>
          <span className="text-2xl font-bold text-primary">
            {Number(formatUnits(yieldBalance, 18)).toFixed(4)} $YIELD
          </span>
        </div>
      </div>

      {/* Seasons */}
      {!seasons || seasons.length === 0 ? (
        <p className="text-sm text-on-surface-variant text-center py-8">
          {t("noSeasons")}
        </p>
      ) : reportedSeasons.length === 0 ? (
        <p className="text-sm text-on-surface-variant text-center py-8">
          {t("noReportedYet")}
        </p>
      ) : (
        <div className="space-y-4">
          {reportedSeasons.map((season) => (
            <SeasonCard
              key={season.id}
              season={season}
              harvestManager={harvestManager}
              user={user}
              userYieldBalance={yieldBalance}
              isConnected={isConnected}
              pendingKind={pendingKind}
              campaignAddress={campaignAddress}
              onRedeemUSDC={(yieldAmount) =>
                runTx(
                  "redeem",
                  writeContractAsync({
                    address: harvestManager,
                    abi: harvestAbi,
                    functionName: "redeemUSDC",
                    args: [BigInt(season.seasonId), yieldAmount],
                  }),
                )
              }
              onClaimUSDC={() =>
                runTx(
                  "claim",
                  writeContractAsync({
                    address: harvestManager,
                    abi: harvestAbi,
                    functionName: "claimUSDC",
                    args: [BigInt(season.seasonId)],
                  }),
                )
              }
              onRedeemProduct={(yieldAmount, proof) =>
                runTx(
                  "redeem",
                  writeContractAsync({
                    address: harvestManager,
                    abi: harvestAbi,
                    functionName: "redeemProduct",
                    args: [BigInt(season.seasonId), yieldAmount, proof],
                  }),
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SeasonCard({
  season,
  harvestManager,
  campaignAddress,
  user,
  userYieldBalance,
  isConnected,
  pendingKind,
  onRedeemUSDC,
  onClaimUSDC,
  onRedeemProduct,
}: {
  season: SubgraphSeason;
  harvestManager: Address;
  campaignAddress: Address;
  user: Address | undefined;
  userYieldBalance: bigint;
  isConnected: boolean;
  pendingKind: string | null;
  onRedeemUSDC: (yieldAmount: bigint) => void;
  onClaimUSDC: () => void;
  onRedeemProduct: (yieldAmount: bigint, proof: `0x${string}`[]) => void;
}) {
  const t = useTranslations("detail.harvest");
  const [redeemAmount, setRedeemAmount] = useState("");

  // Read this user's claim status for this season
  const { data: claimRaw } = useReadContracts({
    contracts: user
      ? [
          {
            address: harvestManager,
            abi: harvestAbi,
            functionName: "claims",
            args: [BigInt(season.seasonId), user],
          },
        ]
      : [],
    query: { enabled: !!user, refetchInterval: 15_000 },
  });

  // claims returns (claimed, redemptionType, amount, usdcAmount, usdcClaimed)
  const claim = claimRaw?.[0]?.result as
    | readonly [boolean, number, bigint, bigint, bigint]
    | undefined;
  const hasClaimed = claim?.[0] ?? false;
  const usdcOwed = claim?.[3] ?? 0n;
  const usdcAlreadyClaimed = claim?.[4] ?? 0n;

  const now = Math.floor(Date.now() / 1000);
  const claimOpen =
    season.claimStart &&
    season.claimEnd &&
    now >= Number(season.claimStart) &&
    now <= Number(season.claimEnd);

  const depositOpen =
    season.usdcDeadline && now <= Number(season.usdcDeadline);

  // For pro-rata USDC: how much USDC this claim is entitled to right now,
  // given current deposits.
  const usdcDeposited = BigInt(season.usdcDeposited);
  const usdcOwedTotal = BigInt(season.usdcOwed);
  const entitled =
    usdcOwedTotal > 0n && usdcDeposited > 0n
      ? (usdcOwed * usdcDeposited) / usdcOwedTotal
      : 0n;
  const claimable = entitled > usdcAlreadyClaimed ? entitled - usdcAlreadyClaimed : 0n;

  const redeemAmountWei = useMemo(() => {
    if (!redeemAmount || Number(redeemAmount) <= 0) return 0n;
    try {
      return parseUnits(redeemAmount, 18);
    } catch {
      return 0n;
    }
  }, [redeemAmount]);

  const canRedeem =
    isConnected &&
    !hasClaimed &&
    claimOpen &&
    redeemAmountWei > 0n &&
    redeemAmountWei <= userYieldBalance;

  return (
    <div className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/15">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
            {t("seasonLabel", { id: season.seasonId })}
          </div>
          <div className="text-lg font-bold text-on-surface">
            {season.totalProductUnits
              ? `${Number(formatUnits(BigInt(season.totalProductUnits), 18)).toLocaleString()} ${t("units")}`
              : "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
            {t("holderPool")}
          </div>
          <div className="text-lg font-bold text-primary">
            $
            {Number(
              formatUnits(BigInt(season.holderPool ?? "0"), 18),
            ).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4 pt-4 border-t border-outline-variant/15 text-xs">
        <div>
          <div className="text-on-surface-variant">{t("claimWindow")}</div>
          <div className="font-semibold text-on-surface">
            {claimOpen ? t("open") : t("closed")}
          </div>
        </div>
        <div>
          <div className="text-on-surface-variant">{t("usdcDeposited")}</div>
          <div className="font-semibold text-on-surface">
            {Number(formatUnits(usdcDeposited, 18)).toLocaleString()} /
            {" "}
            {Number(formatUnits(usdcOwedTotal, 18)).toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-on-surface-variant">{t("depositWindow")}</div>
          <div className="font-semibold text-on-surface">
            {depositOpen ? t("open") : t("closed")}
          </div>
        </div>
      </div>

      {/* Redeem flow (step 1) */}
      {!hasClaimed && claimOpen && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              {t("redeemYieldForUsdc")}
            </label>
            <button
              onClick={() =>
                setRedeemAmount(formatUnits(userYieldBalance, 18))
              }
              className="text-xs text-on-surface-variant hover:text-primary transition-colors"
            >
              {t("balanceYield", {
                amount: Number(formatUnits(userYieldBalance, 18)).toFixed(2),
              })}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={redeemAmount}
              onChange={(e) => setRedeemAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-surface-container rounded-lg px-3 py-2 text-sm border border-outline-variant/15 outline-none focus:border-primary/50"
            />
            <button
              onClick={() => onRedeemUSDC(redeemAmountWei)}
              disabled={!canRedeem || pendingKind !== null}
              className="regen-gradient text-white rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pendingKind === "redeem" ? t("redeeming") : t("redeemUSDC")}
            </button>
          </div>
          {!claimOpen && (
            <p className="text-xs text-on-surface-variant mt-1">
              {t("claimWindowClosed")}
            </p>
          )}
        </div>
      )}

      {/* Claim flow (step 2) */}
      {hasClaimed && (
        <div className="flex items-center justify-between pt-3 border-t border-outline-variant/15">
          <div>
            <div className="text-xs text-on-surface-variant">
              {t("usdcClaimable")}
            </div>
            <div className="text-lg font-bold text-on-surface">
              $
              {Number(formatUnits(claimable, 18)).toFixed(2)}
            </div>
            <div className="text-xs text-on-surface-variant">
              {t("totalEntitled", {
                amount: Number(formatUnits(entitled, 18)).toFixed(2),
                claimed: Number(formatUnits(usdcAlreadyClaimed, 18)).toFixed(2),
              })}
            </div>
          </div>
          <button
            onClick={onClaimUSDC}
            disabled={claimable === 0n || pendingKind !== null}
            className="regen-gradient text-white rounded-full px-6 py-2.5 text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pendingKind === "claim" ? t("claiming") : t("claimUSDC")}
          </button>
        </div>
      )}

      {/* Product redemption (requires merkle proof) */}
      {!hasClaimed && claimOpen && season.merkleRoot && user && (
        <ProductRedemption
          campaignAddress={campaignAddress}
          seasonId={season.seasonId}
          user={user}
          userYieldBalance={userYieldBalance}
          pendingKind={pendingKind}
          onRedeem={onRedeemProduct}
        />
      )}
    </div>
  );
}

function ProductRedemption({
  campaignAddress,
  seasonId,
  user,
  userYieldBalance,
  pendingKind,
  onRedeem,
}: {
  campaignAddress: Address;
  seasonId: string;
  user: Address;
  userYieldBalance: bigint;
  pendingKind: string | null;
  onRedeem: (yieldAmount: bigint, proof: `0x${string}`[]) => void;
}) {
  const t = useTranslations("detail.harvest");

  const { data: proofData, isLoading } = useQuery({
    queryKey: ["merkle-proof", campaignAddress, seasonId, user?.toLowerCase()],
    enabled: !!user,
    queryFn: () => fetchMerkleProof(campaignAddress, seasonId, user),
    retry: 1,
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="mt-3 pt-3 border-t border-outline-variant/15 text-xs text-on-surface-variant">
        {t("checkingProductEligibility")}
      </div>
    );
  }

  if (!proofData) {
    return (
      <div className="mt-3 pt-3 border-t border-outline-variant/15 text-xs text-on-surface-variant">
        🫒 {t("notEligibleForProduct")}
      </div>
    );
  }

  const productAmount = BigInt(proofData.productAmount);

  return (
    <div className="mt-3 pt-3 border-t border-outline-variant/15">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs text-on-surface-variant">
            {t("productEntitlement")}
          </div>
          <div className="text-lg font-bold text-primary">
            🫒{" "}
            {Number(formatUnits(productAmount, 18)).toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}{" "}
            {t("units")}
          </div>
        </div>
        <button
          onClick={() => onRedeem(userYieldBalance, proofData.proof)}
          disabled={userYieldBalance === 0n || pendingKind !== null}
          className="bg-primary text-white rounded-full px-5 py-2 text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pendingKind === "redeem" ? t("redeeming") : t("redeemProduct")}
        </button>
      </div>
      <p className="text-xs text-on-surface-variant">
        {t("productRedeemNote")}
      </p>
    </div>
  );
}
