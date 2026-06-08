"use client";

import { useMemo, useState } from "react";
import { useAccount, useReadContracts, useWriteContract } from "wagmi";
import { formatUnits, parseUnits, type Address } from "viem";
import { useTranslations } from "next-intl";
import { abis, getAddresses } from "@/contracts";
import { erc20Abi } from "@/contracts/erc20";
import { Spinner } from "./Spinner";
import { useTxNotify } from "@/lib/useTxNotify";
import { waitForTx } from "@/lib/waitForTx";

const stakingPoolAbi = abis.GrowStakingPool as never;

type Tab = "stake" | "withdraw";

type TxStatus =
  | { kind: "idle" }
  | { kind: "approving-sig" }
  | { kind: "approving-chain" }
  | { kind: "submitting-sig" }
  | { kind: "submitting-chain" }
  | { kind: "claiming-sig" }
  | { kind: "claiming-chain" }
  | { kind: "success"; hash: `0x${string}` }
  | { kind: "error"; message: string };

const RAMP_DURATION_S = 365 * 24 * 60 * 60;

/**
 * Stake GROW, earn USDC. Time-in-pool multiplier ramps continuously from 1.0×
 * to 2.0× over 365 days. Any withdraw resets the streak.
 *
 * Reads via batched useReadContracts (10s refetch):
 *   - GROW balance + allowance to staking pool
 *   - balanceOf in pool, effectiveBalanceOf, multiplierBps stored
 *   - previewMultiplier (live, not yet applied)
 *   - streakStartAt for the countdown to the cap
 *   - earned (pending USDC)
 *   - rewardRate, periodFinish (so we can show "rewards over X days")
 *
 * Writes:
 *   - approve(GROW → stakingPool, amount)
 *   - stake(amount) | withdraw(amount) | claim()
 */
export function GrowStakingPanel() {
  const t = useTranslations("grow.stake");
  const { address: account, isConnected } = useAccount();
  const a = getAddresses();
  const notify = useTxNotify();
  const { writeContractAsync } = useWriteContract();

  const [tab, setTab] = useState<Tab>("stake");
  const [amountInput, setAmountInput] = useState<string>("");
  const [tx, setTx] = useState<TxStatus>({ kind: "idle" });

  const enabled = Boolean(a.growToken && a.growStakingPool);

  const { data: reads, refetch } = useReadContracts({
    query: { enabled, refetchInterval: 10_000 },
    contracts: [
      {
        abi: erc20Abi,
        address: a.growToken as Address,
        functionName: "balanceOf",
        args: account ? [account] : undefined,
      },
      {
        abi: erc20Abi,
        address: a.growToken as Address,
        functionName: "allowance",
        args: account ? [account, a.growStakingPool as Address] : undefined,
      },
      {
        abi: stakingPoolAbi,
        address: a.growStakingPool as Address,
        functionName: "balanceOf",
        args: account ? [account] : undefined,
      },
      {
        abi: stakingPoolAbi,
        address: a.growStakingPool as Address,
        functionName: "multiplierBps",
        args: account ? [account] : undefined,
      },
      {
        abi: stakingPoolAbi,
        address: a.growStakingPool as Address,
        functionName: "previewMultiplier",
        args: account ? [account] : undefined,
      },
      {
        abi: stakingPoolAbi,
        address: a.growStakingPool as Address,
        functionName: "streakStartAt",
        args: account ? [account] : undefined,
      },
      {
        abi: stakingPoolAbi,
        address: a.growStakingPool as Address,
        functionName: "earned",
        args: account ? [account] : undefined,
      },
      {
        abi: stakingPoolAbi,
        address: a.growStakingPool as Address,
        functionName: "rewardRate",
      },
      {
        abi: stakingPoolAbi,
        address: a.growStakingPool as Address,
        functionName: "periodFinish",
      },
      {
        abi: stakingPoolAbi,
        address: a.growStakingPool as Address,
        functionName: "totalStaked",
      },
    ],
  });

  const growBalance = (reads?.[0]?.result as bigint | undefined) ?? 0n;
  const allowance = (reads?.[1]?.result as bigint | undefined) ?? 0n;
  const staked = (reads?.[2]?.result as bigint | undefined) ?? 0n;
  const storedMul = (reads?.[3]?.result as bigint | undefined) ?? 0n;
  const liveMul = (reads?.[4]?.result as bigint | undefined) ?? 0n;
  const streakStart = (reads?.[5]?.result as bigint | undefined) ?? 0n;
  const earned = (reads?.[6]?.result as bigint | undefined) ?? 0n;
  const rewardRate = (reads?.[7]?.result as bigint | undefined) ?? 0n;
  const periodFinish = (reads?.[8]?.result as bigint | undefined) ?? 0n;
  const totalStaked = (reads?.[9]?.result as bigint | undefined) ?? 0n;
  const earnedUsdc = Number(formatUnits(earned, 6)).toFixed(4);
  const totalStakedGrow = Number(formatUnits(totalStaked, 18)).toFixed(2);
  const walletGrow = Number(formatUnits(growBalance, 18)).toFixed(4);
  const stakedGrow = Number(formatUnits(staked, 18)).toFixed(4);

  const amount = useMemo(() => {
    if (!amountInput) return 0n;
    try {
      return parseUnits(amountInput, 18);
    } catch {
      return 0n;
    }
  }, [amountInput]);

  const needsApproval = tab === "stake" && amount > 0n && allowance < amount;
  const insufficient =
    tab === "stake" ? amount > growBalance : amount > staked;

  const liveMulPct = Number(liveMul) / 100; // bps → percent
  const storedMulPct = Number(storedMul) / 100;

  const secondsUntilCap = useMemo(() => {
    if (streakStart === 0n) return RAMP_DURATION_S;
    const elapsed = Math.floor(Date.now() / 1000) - Number(streakStart);
    return Math.max(0, RAMP_DURATION_S - elapsed);
  }, [streakStart]);
  const rampProgressPct =
    staked === 0n
      ? 0
      : Math.min(
          100,
          Math.max(0, ((RAMP_DURATION_S - secondsUntilCap) / RAMP_DURATION_S) * 100),
        );

  const periodSecondsLeft = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, Number(periodFinish) - now);
  }, [periodFinish]);

  const isBusy =
    tx.kind !== "idle" && tx.kind !== "success" && tx.kind !== "error";

  async function handleStakeOrWithdraw() {
    if (!account || amount === 0n || !a.growToken || !a.growStakingPool) return;
    try {
      if (tab === "stake" && needsApproval) {
        setTx({ kind: "approving-sig" });
        const approveHash = await writeContractAsync({
          abi: erc20Abi,
          address: a.growToken as Address,
          functionName: "approve",
          args: [a.growStakingPool, amount],
        });
        setTx({ kind: "approving-chain" });
        await waitForTx(approveHash);
      }

      setTx({ kind: "submitting-sig" });
      const hash = await writeContractAsync({
        abi: stakingPoolAbi,
        address: a.growStakingPool as Address,
        functionName: tab === "stake" ? "stake" : "withdraw",
        args: [amount],
      });
      setTx({ kind: "submitting-chain" });
      await waitForTx(hash);
      notify.success(tab === "stake" ? "Staked" : "Withdrawn", hash);
      setTx({ kind: "success", hash });
      setAmountInput("");
      refetch();
    } catch (err) {
      const message =
        (err as Error).message?.split("\n")[0] ?? "Transaction failed";
      if (/user (rejected|denied)/i.test(message)) {
        setTx({ kind: "idle" });
        return;
      }
      notify.error(`${tab === "stake" ? "Stake" : "Withdraw"} failed`, message);
      setTx({ kind: "error", message });
    }
  }

  async function handleClaim() {
    if (!account || !a.growStakingPool) return;
    try {
      setTx({ kind: "claiming-sig" });
      const hash = await writeContractAsync({
        abi: stakingPoolAbi,
        address: a.growStakingPool as Address,
        functionName: "claim",
      });
      setTx({ kind: "claiming-chain" });
      await waitForTx(hash);
      notify.success("Claimed USDC", hash);
      setTx({ kind: "success", hash });
      refetch();
    } catch (err) {
      const message =
        (err as Error).message?.split("\n")[0] ?? "Transaction failed";
      if (/user (rejected|denied)/i.test(message)) {
        setTx({ kind: "idle" });
        return;
      }
      notify.error("Claim failed", message);
      setTx({ kind: "error", message });
    }
  }

  if (!a.growStakingPool || !a.growToken) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        {t("notDeployed")}
      </div>
    );
  }

  return (
    <div className="rounded-[8px] border border-zinc-200 bg-white p-5 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.65)] md:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            {t("pendingUsdc")}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">
            {t("title")}
          </h2>
        </div>
        <span className="max-w-[132px] rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-right text-[11px] font-medium leading-4 text-zinc-500 sm:max-w-[150px]">
          {t("totalStaked", {
            amount: totalStakedGrow,
          })}
        </span>
      </div>
      <p className="mb-5 text-sm leading-6 text-zinc-600">{t("blurb")}</p>

      <div className="-mx-5 mb-5 border-y border-zinc-200 bg-[#f6f8f4] px-5 py-4 md:-mx-6 md:px-6">
        <div className="mb-4 border-b border-emerald-900/10 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                {t("rewardBalance")}
              </div>
              <div className="mt-1 flex items-baseline gap-2 font-mono text-4xl leading-none text-zinc-950">
                {earnedUsdc}
                <span className="text-sm font-semibold text-zinc-500">USDC</span>
              </div>
            </div>
            <p className="max-w-[260px] text-xs leading-5 text-zinc-500">
              {t("rewardBalanceHint")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {t("multiplier")}
            </div>
            <div className="mt-1 font-mono text-2xl text-emerald-700">
              {staked === 0n ? "—" : `${(liveMulPct / 100).toFixed(2)}×`}
            </div>
            {storedMul !== liveMul && staked > 0n && (
              <div className="mt-1 text-[10px] leading-4 text-zinc-500">
                {t("multiplierStored", {
                  value: (storedMulPct / 100).toFixed(2),
                })}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {t("timeToCap")}
            </div>
            <div className="mt-1 font-mono text-2xl text-zinc-950">
              {staked === 0n
                ? "—"
                : secondsUntilCap === 0
                  ? t("max")
                  : `${Math.ceil(secondsUntilCap / 86400)}d`}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {t("distribution")}
            </div>
            <div className="mt-1 font-mono text-2xl text-zinc-950">
              {rewardRate > 0n && periodSecondsLeft > 0
                ? `${Math.ceil(periodSecondsLeft / 86400)}d`
                : "—"}
            </div>
            {rewardRate > 0n && periodSecondsLeft > 0 && (
              <div className="mt-1 text-[10px] leading-4 text-zinc-500">
                {t("distEndsIn", {
                  days: Math.ceil(periodSecondsLeft / 86400),
                })}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full rounded-full bg-emerald-600"
            style={{ width: `${rampProgressPct}%` }}
          />
        </div>
      </div>

      <div className="mb-3 flex gap-1 rounded-[8px] border border-zinc-200 bg-zinc-100 p-1 text-sm font-semibold">
        <button
          type="button"
          onClick={() => {
            setTab("stake");
            setAmountInput("");
          }}
          className={`flex-1 rounded-[6px] px-3 py-2 transition ${
            tab === "stake"
              ? "bg-white text-zinc-950 shadow-sm"
              : "text-zinc-500"
          }`}
        >
          {t("stakeTab")}
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("withdraw");
            setAmountInput("");
          }}
          className={`flex-1 rounded-[6px] px-3 py-2 transition ${
            tab === "withdraw"
              ? "bg-white text-zinc-950 shadow-sm"
              : "text-zinc-500"
          }`}
        >
          {t("withdrawTab")}
        </button>
      </div>

      {tab === "withdraw" && staked > 0n && (
        <div className="mb-3 rounded-[8px] border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          {t("withdrawWarning")}
        </div>
      )}

      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {tab === "stake" ? t("amountToStake") : t("amountToWithdraw")}
      </label>
      <div className="mb-3 flex min-h-[54px] overflow-hidden rounded-[8px] border border-zinc-300 bg-white focus-within:border-emerald-600">
        <input
          type="text"
          inputMode="decimal"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          placeholder="0.00"
          className="min-w-0 flex-1 px-3 py-2 font-mono text-lg text-zinc-950 outline-none"
        />
        <button
          type="button"
          onClick={() =>
            setAmountInput(
              tab === "stake"
                ? formatUnits(growBalance, 18)
                : formatUnits(staked, 18),
            )
          }
          className="border-l border-zinc-200 bg-zinc-50 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
        >
          {t("max")}
        </button>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 text-xs text-zinc-500">
        <span className="text-right">
          {t("wallet")}:{" "}
          <span className="font-mono">{walletGrow}</span>{" "}
          $GROW
        </span>
        <span>
          {t("stakedLabel")}:{" "}
          <span className="font-mono">{stakedGrow}</span>{" "}
          $GROW
        </span>
      </div>
      {insufficient && (
        <p className="mb-2 text-xs text-rose-600">
          {tab === "stake" ? t("insufficientBalance") : t("insufficientStaked")}
        </p>
      )}

      <button
        type="button"
        onClick={handleStakeOrWithdraw}
        disabled={!isConnected || isBusy || amount === 0n || insufficient}
        className="mb-2 flex w-full items-center justify-center gap-2 rounded-[8px] bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        {isBusy && tx.kind !== "claiming-sig" && tx.kind !== "claiming-chain" && (
          <Spinner />
        )}
        {!isConnected
          ? t("connectWallet")
          : tx.kind === "approving-sig"
            ? t("approveGrow")
            : tx.kind === "approving-chain"
              ? t("approvingChain")
              : tx.kind === "submitting-sig"
                ? t("submittingSig")
                : tx.kind === "submitting-chain"
                  ? t("submittingChain")
                  : tab === "stake"
                    ? needsApproval
                      ? t("approveAndStake")
                      : t("stakeButton")
                    : t("withdrawButton")}
      </button>

      <button
        type="button"
        onClick={handleClaim}
        disabled={!isConnected || isBusy || earned === 0n}
        className="flex w-full items-center justify-center gap-2 rounded-[8px] border border-emerald-600 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
      >
        {(tx.kind === "claiming-sig" || tx.kind === "claiming-chain") && (
          <Spinner />
        )}
        {tx.kind === "claiming-sig"
          ? t("claimSig")
          : tx.kind === "claiming-chain"
            ? t("claimingChain")
              : earned === 0n
                ? t("nothingToClaim")
                : t("claim", {
                    amount: earnedUsdc,
                  })}
      </button>

      {tx.kind === "error" && (
        <p className="mt-2 text-xs text-rose-600">{tx.message}</p>
      )}
    </div>
  );
}
