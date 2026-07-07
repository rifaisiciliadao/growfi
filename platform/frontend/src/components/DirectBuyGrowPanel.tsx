"use client";

import { useMemo, useState } from "react";
import { useAccount, useReadContracts, useWriteContract } from "wagmi";
import { formatUnits, parseUnits, type Address } from "viem";
import { useTranslations } from "next-intl";
import { abis, CHAIN_ID, getAddresses } from "@/contracts";
import { erc20Abi } from "@/contracts/erc20";
import { Spinner } from "./Spinner";
import { useTxNotify } from "@/lib/useTxNotify";
import { waitForTx } from "@/lib/waitForTx";
import { useExpectedChain } from "@/lib/useExpectedChain";

type StableOption = {
  address: Address;
  symbol: string;
  decimals: number;
};

type TxStatus =
  | { kind: "idle" }
  | { kind: "approving-sig" }
  | { kind: "approving-chain" }
  | { kind: "buying-sig" }
  | { kind: "buying-chain" }
  | { kind: "minting-sig" }
  | { kind: "minting-chain" }
  | { kind: "success"; hash: `0x${string}` }
  | { kind: "error"; message: string };

const growTokenAbi = abis.GrowToken as never;
const growTreasuryAbi = abis.GrowTreasury as never;
const WAGMI_CHAIN_ID = CHAIN_ID as never;

/// Both MockUSDC and MockStablecoin expose `mint(address, uint256)` permissionlessly
/// on testnet/anvil. Constructor revert on mainnet chain ids guards production.
const mockMintAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

/**
 * GROW direct-buy panel.
 *
 * Reads:
 *  - Treasury.intrinsicFloorPrice (USD-18 per circulating GROW)
 *  - Token.markupBps + Token.referencePrice (fallback path)
 *  - Token.saleActive (kill switch)
 *  - Per-stablecoin: Treasury.getStablecoinPriceUsd18 (live Chainlink)
 *
 * Writes (2 sigs):
 *  - ERC20.approve(GROW token, paymentAmount)
 *  - GrowToken.buy(paymentToken, paymentAmount, maxPriceAccepted)
 *
 * The contract validates the stablecoin allowlist and Chainlink feed again
 * inside `buy`. The frontend uses a $1 quote fallback if the public RPC read
 * flakes, so a transient quote read failure cannot block a valid purchase.
 */
export function DirectBuyGrowPanel() {
  const t = useTranslations("grow.buy");
  const tn = useTranslations("network");
  const { address: account, isConnected } = useAccount();
  const {
    expectedChain,
    isSwitching,
    isWrongChain,
    switchToExpectedChain,
  } = useExpectedChain();
  const a = getAddresses();
  const notify = useTxNotify();
  const { writeContractAsync } = useWriteContract();

  /// Faucet visible on testnets where the stablecoins are MockUSDC/MockStablecoin
  /// (public mint). Mainnet stablecoins do NOT have public mint, so the button
  /// is gated. Allow: anvil (31337), Base Sepolia (84532), ETH Sepolia (11155111).
  const faucetEnabled =
    CHAIN_ID === 31337 || CHAIN_ID === 84532 || CHAIN_ID === 11155111;

  const stableOptions = useMemo<StableOption[]>(() => {
    const out: StableOption[] = [];
    if (a.usdc) out.push({ address: a.usdc, symbol: "USDC", decimals: 6 });
    if (CHAIN_ID !== 1 && a.usdt) {
      out.push({ address: a.usdt, symbol: "USDT", decimals: 6 });
    }
    if (CHAIN_ID !== 1 && a.dai) {
      out.push({ address: a.dai, symbol: "DAI", decimals: 18 });
    }
    return out;
  }, [a.usdc, a.usdt, a.dai]);

  const [selectedSym, setSelectedSym] = useState<string>(
    stableOptions[0]?.symbol ?? "USDC",
  );
  const [paymentInput, setPaymentInput] = useState<string>("10");
  const [tx, setTx] = useState<TxStatus>({ kind: "idle" });

  const selected =
    stableOptions.find((s) => s.symbol === selectedSym) ?? stableOptions[0];

  // Quote & balance reads
  const {
    data: reads,
    isLoading: readsLoading,
    refetch,
  } = useReadContracts({
    query: { enabled: Boolean(a.growToken && a.growTreasury && selected) },
    contracts: [
      {
        abi: growTreasuryAbi,
        address: a.growTreasury as Address,
        chainId: WAGMI_CHAIN_ID,
        functionName: "intrinsicFloorPrice",
      },
      {
        abi: growTokenAbi,
        address: a.growToken as Address,
        chainId: WAGMI_CHAIN_ID,
        functionName: "markupBps",
      },
      {
        abi: growTokenAbi,
        address: a.growToken as Address,
        chainId: WAGMI_CHAIN_ID,
        functionName: "referencePrice",
      },
      {
        abi: growTokenAbi,
        address: a.growToken as Address,
        chainId: WAGMI_CHAIN_ID,
        functionName: "saleActive",
      },
      {
        abi: growTreasuryAbi,
        address: a.growTreasury as Address,
        chainId: WAGMI_CHAIN_ID,
        functionName: "getStablecoinPriceUsd18",
        args: selected ? [selected.address] : undefined,
      },
      {
        abi: erc20Abi,
        address: selected?.address as Address,
        chainId: WAGMI_CHAIN_ID,
        functionName: "balanceOf",
        args: account ? [account] : undefined,
      },
      {
        abi: erc20Abi,
        address: selected?.address as Address,
        chainId: WAGMI_CHAIN_ID,
        functionName: "allowance",
        args: account ? [account, a.growToken as Address] : undefined,
      },
    ],
  });

  const floor = (reads?.[0]?.result as bigint | undefined) ?? 0n;
  const markupBps = (reads?.[1]?.result as bigint | undefined) ?? 1_000n;
  const referencePrice = (reads?.[2]?.result as bigint | undefined) ?? 0n;
  const saleActiveResult = reads?.[3]?.result as boolean | undefined;
  const saleActiveKnown = typeof saleActiveResult === "boolean";
  const saleActive = saleActiveResult === true;
  const stablePrice = reads?.[4]; // result | error
  const balance = (reads?.[5]?.result as bigint | undefined) ?? 0n;
  const allowance = (reads?.[6]?.result as bigint | undefined) ?? 0n;

  const livePriceUsd18 =
    (stablePrice?.result as bigint | undefined) ?? 1_000_000_000_000_000_000n;

  const refPrice = floor > 0n ? floor : referencePrice;
  const salePrice = useMemo(() => {
    if (refPrice === 0n) return 0n;
    return (refPrice * (10_000n + markupBps)) / 10_000n;
  }, [refPrice, markupBps]);

  const paymentAmount = useMemo(() => {
    if (!selected || !paymentInput) return 0n;
    try {
      return parseUnits(paymentInput, selected.decimals);
    } catch {
      return 0n;
    }
  }, [paymentInput, selected]);

  // growOut = paymentAmount × scale × livePriceUsd18 / salePrice
  // scale = 10^(18 - decimals) for stablecoins.
  const growOut = useMemo(() => {
    if (
      !selected ||
      paymentAmount === 0n ||
      salePrice === 0n ||
      livePriceUsd18 === 0n
    )
      return 0n;
    const scale = 10n ** BigInt(18 - selected.decimals);
    return (paymentAmount * scale * livePriceUsd18) / salePrice;
  }, [paymentAmount, salePrice, livePriceUsd18, selected]);

  const needsApproval = paymentAmount > 0n && allowance < paymentAmount;
  const insufficientBalance = paymentAmount > 0n && balance < paymentAmount;

  const isBusy = tx.kind !== "idle" && tx.kind !== "success" && tx.kind !== "error";

  async function handleMint() {
    if (!account || !selected || !faucetEnabled) return;
    if (isWrongChain) {
      await switchToExpectedChain();
      return;
    }
    try {
      setTx({ kind: "minting-sig" });
      const amount = selected.decimals === 6 ? 10_000n * 10n ** 6n : 10_000n * 10n ** 18n;
      const hash = await writeContractAsync({
        abi: mockMintAbi,
        address: selected.address,
        chainId: WAGMI_CHAIN_ID,
        functionName: "mint",
        args: [account, amount],
      });
      setTx({ kind: "minting-chain" });
      await waitForTx(hash);
      notify.success(`Minted 10,000 ${selected.symbol}`, hash);
      setTx({ kind: "idle" });
      refetch();
    } catch (err) {
      const message =
        (err as Error).message?.split("\n")[0] ?? "Transaction failed";
      if (/user (rejected|denied)/i.test(message)) {
        setTx({ kind: "idle" });
        return;
      }
      notify.error("Mint failed", message);
      setTx({ kind: "error", message });
    }
  }

  async function handleBuy() {
    if (isWrongChain) {
      try {
        await switchToExpectedChain();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setTx({ kind: "error", message });
      }
      return;
    }
    if (
      !account ||
      !selected ||
      !a.growToken ||
      paymentAmount === 0n
    )
      return;

    try {
      if (needsApproval) {
        setTx({ kind: "approving-sig" });
        const approveHash = await writeContractAsync({
          abi: erc20Abi,
          address: selected.address,
          chainId: WAGMI_CHAIN_ID,
          functionName: "approve",
          args: [a.growToken, paymentAmount],
        });
        setTx({ kind: "approving-chain" });
        await waitForTx(approveHash);
      }

      // Slippage cap: accept up to +5% beyond current salePrice
      const maxPriceAccepted = (salePrice * 10_500n) / 10_000n;

      setTx({ kind: "buying-sig" });
      const buyHash = await writeContractAsync({
        abi: growTokenAbi,
        address: a.growToken as Address,
        chainId: WAGMI_CHAIN_ID,
        functionName: "buy",
        args: [selected.address, paymentAmount, maxPriceAccepted],
      });
      setTx({ kind: "buying-chain" });
      await waitForTx(buyHash);
      notify.success("Bought GROW", buyHash);
      setTx({ kind: "success", hash: buyHash });
      refetch();
    } catch (err) {
      const message =
        (err as Error).message?.split("\n")[0] ?? "Transaction failed";
      if (/user (rejected|denied)/i.test(message)) {
        setTx({ kind: "idle" });
        return;
      }
      notify.error("Buy failed", message);
      setTx({ kind: "error", message });
    }
  }

  if (!a.growToken || !a.growTreasury) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        {t("notDeployed")}
      </div>
    );
  }

  const markupPct = Number(markupBps) / 100;
  const formattedSalePrice =
    salePrice === 0n ? "—" : formatUsd18(salePrice, 4, 6);

  return (
    <div className="app-card rounded-[1.35rem] p-5 md:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            {t("salePriceHint", { markup: markupPct.toLocaleString() })}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-on-surface">
            {t("title")}
          </h2>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
            saleActive
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {saleActive ? "ON" : saleActiveKnown ? "OFF" : "..."}
        </span>
      </div>
      {!readsLoading && saleActiveKnown && !saleActive && (
        <div className="mb-4 rounded-[8px] border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t("salePaused")}
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-outline-variant/25 bg-surface-container-low px-4 py-3.5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">
              {t("salePrice")}
            </div>
            <div className="mt-1 text-3xl font-bold tracking-[-0.04em] text-on-surface">
              {formattedSalePrice}
            </div>
          </div>
          <div className="pb-1 text-right text-xs leading-5 text-on-surface-variant">
            {selected?.symbol ?? "USDC"}
            <br />
            OK
          </div>
        </div>
      </div>

      <div className="mb-1 flex items-baseline justify-between">
        <label className="block text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
          {t("payWith")}
        </label>
        {faucetEnabled && isConnected && selected && (
          <button
            type="button"
            onClick={handleMint}
            disabled={
              tx.kind === "minting-sig" || tx.kind === "minting-chain"
            }
            className="text-xs font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-on-surface-variant/50"
          >
            {tx.kind === "minting-sig"
              ? t("confirmInWallet")
              : tx.kind === "minting-chain"
                ? t("minting")
                : t("mintFaucet", { symbol: selected.symbol })}
          </button>
        )}
      </div>
      <div className="mb-4 flex gap-1 rounded-full border border-outline-variant/25 bg-surface-container-low p-1">
        {stableOptions.map((s) => (
          <button
            key={s.symbol}
            type="button"
            onClick={() => setSelectedSym(s.symbol)}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ${
              selectedSym === s.symbol
                ? "bg-white text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {s.symbol}
          </button>
        ))}
      </div>

      <label className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
        {t("youPay")}
      </label>
      <div className="mb-3 flex min-h-[54px] overflow-hidden rounded-2xl border border-outline-variant/25 bg-white focus-within:border-primary">
        <input
          type="text"
          inputMode="decimal"
          value={paymentInput}
          onChange={(e) => setPaymentInput(e.target.value)}
          placeholder="0.00"
          className="min-w-0 flex-1 px-4 py-2 text-lg font-semibold tracking-[-0.02em] text-on-surface outline-none"
        />
        <div className="flex w-20 items-center justify-center border-l border-outline-variant/20 bg-surface-container-low text-sm font-semibold text-on-surface-variant">
          {selected?.symbol}
        </div>
      </div>
      <div className="mb-4 flex items-center justify-between gap-3 text-xs text-on-surface-variant">
        <button
          type="button"
          onClick={() =>
            selected && setPaymentInput(formatUnits(balance, selected.decimals))
          }
          disabled={!selected}
          className="min-h-[28px] -mx-2 rounded-full px-2 text-left transition hover:bg-surface-container-low hover:text-primary disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-on-surface-variant"
        >
          {t("balance")}:{" "}
          <span className="font-mono">
            {selected ? formatUnits(balance, selected.decimals) : "—"}
          </span>{" "}
          <span className="font-semibold">MAX</span>
        </button>
        {insufficientBalance && (
          <span className="text-rose-600">{t("insufficientBalance")}</span>
        )}
      </div>

      <div className="mb-4 border-t border-outline-variant/15 pt-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              {t("youReceive")}
            </div>
            <div className="mt-1 text-3xl font-bold tracking-[-0.04em] text-on-surface">
              {growOut === 0n
                ? "—"
                : Number(formatUnits(growOut, 18)).toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
            </div>
          </div>
          <div className="pb-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">
            $GROW
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleBuy}
        disabled={
          !isConnected ||
          isSwitching ||
          isBusy ||
          (!isWrongChain &&
            (!saleActiveKnown ||
              !saleActive ||
              paymentAmount === 0n ||
              insufficientBalance ||
              salePrice === 0n))
        }
        className="flex w-full items-center justify-center gap-2 rounded-full bg-on-surface px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-outline-variant"
      >
        {isBusy && <Spinner />}
        {!isConnected
          ? t("connectWallet")
          : isWrongChain
            ? tn("action", { chain: expectedChain.name })
            : tx.kind === "approving-sig"
              ? t("approvingSig")
              : tx.kind === "approving-chain"
                ? t("approvingChain")
                : tx.kind === "buying-sig"
                  ? t("buyingSig")
                  : tx.kind === "buying-chain"
                    ? t("buyingChain")
                    : needsApproval && selected
                      ? t("approveAndBuy", { symbol: selected.symbol })
                      : t("buyButton")}
      </button>

      {tx.kind === "error" && (
        <p className="mt-2 text-xs text-rose-600">{tx.message}</p>
      )}
    </div>
  );
}

function formatUsd18(value: bigint, minDigits: number, maxDigits: number) {
  const amount = Number(formatUnits(value, 18));
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  })}`;
}
