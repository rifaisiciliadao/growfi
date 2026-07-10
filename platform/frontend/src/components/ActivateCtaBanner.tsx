"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useWriteContract } from "wagmi";
import type { Address } from "viem";
import { abis } from "@/contracts";
import { Spinner } from "./Spinner";
import { useTxNotify } from "@/lib/useTxNotify";
import { waitForTx } from "@/lib/waitForTx";

/**
 * Permissionless CTA once a campaign has crossed minCap but remains in
 * Funding. Any connected wallet can activate because all release
 * conditions are enforced on-chain.
 *
 * Rendered only when all three conditions line up:
 *   - state === Funding (0)
 *   - currentSupply >= minCap
 *
 * This is a banner, not a tab, so the recovery action remains visible.
 */
export function ActivateCtaBanner({
  campaignAddress,
  currentState,
  currentSupply,
  minCap,
  onActivated,
}: {
  campaignAddress: Address;
  currentState: number;
  currentSupply: bigint;
  minCap: bigint;
  onActivated?: () => void;
}) {
  const t = useTranslations("detail.activateCta");
  const tx = useTranslations("tx");
  const notify = useTxNotify();
  const { writeContractAsync } = useWriteContract();
  const [pending, setPending] = useState<"sig" | "chain" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shouldShow = currentState === 0 && currentSupply >= minCap;
  if (!shouldShow) return null;

  const handleActivate = async () => {
    setError(null);
    setPending("sig");
    try {
      const hash = await writeContractAsync({
        address: campaignAddress,
        abi: abis.Campaign as never,
        functionName: "activateCampaign",
      });
      setPending("chain");
      const r = await waitForTx(hash);
      if (r.status !== "success") throw new Error("activateCampaign reverted");
      onActivated?.();
      notify.success(tx("activateConfirmed"), hash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/user (rejected|denied)/i.test(msg)) setError(msg);
      notify.error(tx("activateFailed"), err);
      console.error(err);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="bg-primary-fixed/30 border border-primary/30 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between mb-6">
      <div className="flex items-start gap-3">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-primary shrink-0 mt-0.5"
        >
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
        <div>
          <div className="font-bold text-primary-container text-sm">
            {t("title")}
          </div>
          <p className="text-xs text-on-surface mt-0.5">{t("body")}</p>
        </div>
      </div>
      <button
        onClick={handleActivate}
        disabled={pending !== null}
        className="regen-gradient text-white rounded-full h-11 px-6 text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
      >
        {pending !== null && <Spinner size={16} />}
        {pending === "sig"
          ? t("sig")
          : pending === "chain"
            ? t("chain")
            : t("cta")}
      </button>
      {error && (
        <div className="w-full bg-red-50 border border-red-200 text-error rounded-lg p-2 text-xs break-words">
          {error}
        </div>
      )}
    </div>
  );
}
