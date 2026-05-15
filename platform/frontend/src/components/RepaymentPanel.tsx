"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { formatUnits, parseUnits, type Address } from "viem";
import { erc20Abi } from "@/contracts/erc20";
import { repaymentModuleAbi } from "@/contracts/repayment";
import { useTxNotify } from "@/lib/useTxNotify";
import { waitForTx } from "@/lib/waitForTx";
import { Spinner } from "./Spinner";

type RepaymentPoolSnapshot = {
  initialized: boolean;
  bonusPerCt: string;
  poolBalance: string;
  totalRedeemed: string;
  redeemCount: number;
} | null;

interface Props {
  campaignAddress: Address;
  campaignToken: Address;
  currentState: number;
  repaymentPool?: RepaymentPoolSnapshot;
}

type ReadResult = { status?: string; result?: unknown };

export function RepaymentPanel({
  campaignAddress,
  campaignToken,
  currentState,
  repaymentPool = null,
}: Props) {
  const t = useTranslations("detail.repayment");
  const { address: user, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const notify = useTxNotify();

  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState<"sig" | "chain" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const readContracts = useMemo(
    () => [
      { address: campaignAddress, abi: repaymentModuleAbi, functionName: "poolBalance" },
      { address: campaignAddress, abi: repaymentModuleAbi, functionName: "bonusPerCt" },
      { address: campaignAddress, abi: repaymentModuleAbi, functionName: "payoutPerCt" },
      ...(user
        ? [
            {
              address: campaignAddress,
              abi: repaymentModuleAbi,
              functionName: "claimedByUser",
              args: [user],
            },
            {
              address: campaignToken,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [user],
            },
          ]
        : []),
    ],
    [campaignAddress, campaignToken, user],
  );

  const { data: reads, refetch } = useReadContracts({
    contracts: readContracts as never,
    query: { enabled: Boolean(campaignAddress), refetchInterval: 15_000 },
  });

  const { data: symbolRaw } = useReadContract({
    address: campaignToken,
    abi: erc20Abi,
    functionName: "symbol",
  });

  const parsedAmount = useMemo(() => {
    if (!amount || Number(amount) <= 0) return 0n;
    try {
      return parseUnits(amount, 18);
    } catch {
      return 0n;
    }
  }, [amount]);

  const attachedOnchain = (reads?.[0] as ReadResult | undefined)?.status === "success";
  const attached = Boolean(repaymentPool?.initialized) || attachedOnchain;

  const poolBalance =
    ((reads?.[0] as ReadResult | undefined)?.result as bigint | undefined) ??
    BigInt(repaymentPool?.poolBalance ?? "0");
  const bonusPerCt =
    ((reads?.[1] as ReadResult | undefined)?.result as bigint | undefined) ??
    BigInt(repaymentPool?.bonusPerCt ?? "0");
  const payoutPerCt =
    ((reads?.[2] as ReadResult | undefined)?.result as bigint | undefined) ?? 0n;
  const claimedByUser = ((reads?.[3] as ReadResult | undefined)?.result as bigint | undefined) ?? 0n;
  const freeBalance = ((reads?.[4] as ReadResult | undefined)?.result as bigint | undefined) ?? 0n;

  const { data: quoteRaw } = useReadContract({
    address: campaignAddress,
    abi: repaymentModuleAbi,
    functionName: "quoteRepayment",
    args: [parsedAmount],
    query: { enabled: attached && parsedAmount > 0n },
  });

  if (!attached) return null;

  const symbol = (symbolRaw as string | undefined) ?? "CT";
  const quote = (quoteRaw as bigint | undefined) ?? 0n;
  const poolCoversCt = payoutPerCt > 0n ? (poolBalance * 10n ** 18n) / payoutPerCt : 0n;
  const tooMuchBalance = parsedAmount > freeBalance;
  const poolTooSmall = quote > poolBalance;
  const ended = currentState === 3;
  const canRedeem =
    isConnected &&
    !ended &&
    parsedAmount > 0n &&
    !tooMuchBalance &&
    !poolTooSmall &&
    pending === null;

  async function handleRedeem() {
    if (!canRedeem) return;
    setError(null);
    setPending("sig");
    try {
      const hash = await writeContractAsync({
        address: campaignAddress,
        abi: repaymentModuleAbi,
        functionName: "redeem",
        args: [parsedAmount, []],
      });
      setPending("chain");
      const receipt = await waitForTx(hash);
      if (receipt.status !== "success") throw new Error("Repayment reverted");
      setAmount("");
      await refetch();
      notify.success(t("redeemConfirmed"), hash);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/user (rejected|denied)/i.test(message)) setError(message);
      notify.error(t("redeemFailed"), err);
    } finally {
      setPending(null);
    }
  }

  const buttonLabel = !isConnected
    ? t("connectFirst")
    : ended
      ? t("ended")
      : pending === "sig"
        ? t("redeemSig")
        : pending === "chain"
          ? t("redeemChain")
          : tooMuchBalance
            ? t("insufficientBalance")
            : poolTooSmall
              ? t("poolTooSmall")
              : t("redeemCta");

  return (
    <div className="rounded-2xl border border-emerald-700/20 bg-emerald-50/55 p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-700/15 bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {t("eyebrow")}
          </div>
          <h3 className="text-lg font-bold tracking-tight text-on-surface">
            {t("title")}
          </h3>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant">
            {t("subtitle", { symbol })}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-700/15 bg-white/75 px-4 py-3 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
            {t("pool")}
          </div>
          <div className="text-xl font-bold text-on-surface">
            {formatUsdc6(poolBalance)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label={t("payoutPerCt")} value={formatUsdc6(payoutPerCt)} />
        <Metric label={t("bonusPerCt")} value={formatUsdc6(bonusPerCt)} />
        <Metric label={t("poolCovers")} value={`${formatCt(poolCoversCt)} ${symbol}`} />
        <Metric
          label={t("redeemed")}
          value={formatUsdc6(BigInt(repaymentPool?.totalRedeemed ?? "0"))}
        />
      </div>

      <div className="mt-5 rounded-xl border border-emerald-700/10 bg-white/75 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            {t("amountLabel", { symbol })}
          </label>
          {isConnected && (
            <button
              type="button"
              onClick={() => setAmount(formatUnits(freeBalance, 18))}
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              {t("balance", { amount: formatCt(freeBalance), symbol })}
            </button>
          )}
        </div>
        <div className="flex min-h-[54px] overflow-hidden rounded-xl border border-outline-variant/20 bg-white focus-within:border-emerald-600">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            className="min-w-0 flex-1 bg-transparent px-4 py-2 text-2xl font-bold text-on-surface outline-none"
          />
          <div className="flex min-w-24 items-center justify-center border-l border-outline-variant/15 bg-surface-container-low px-3 text-sm font-semibold text-on-surface">
            ${symbol}
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 text-xs text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
          <span>
            {parsedAmount > 0n
              ? t("quote", { amount: formatUsdc6(quote) })
              : isConnected
                ? t("idleHint")
                : t("connectHint")}
          </span>
          {claimedByUser > 0n && (
            <span>{t("claimed", { amount: formatUsdc6(claimedByUser) })}</span>
          )}
        </div>
        {freeBalance === 0n && isConnected && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {t("stakedHint")}
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-error">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={handleRedeem}
          disabled={!canRedeem}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          {pending && <Spinner size={16} />}
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-emerald-700/10 bg-white/70 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </div>
      <div className="mt-1 text-sm font-bold text-on-surface">{value}</div>
    </div>
  );
}

function formatUsdc6(value: bigint) {
  const n = Number(formatUnits(value, 6));
  return `$${n.toLocaleString(undefined, {
    maximumFractionDigits: n >= 100 ? 0 : 2,
  })}`;
}

function formatCt(value: bigint) {
  const n = Number(formatUnits(value, 18));
  return n.toLocaleString(undefined, {
    maximumFractionDigits: n >= 100 ? 0 : 2,
  });
}
