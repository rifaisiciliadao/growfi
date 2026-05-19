"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useExpectedChain } from "@/lib/useExpectedChain";

export function NetworkGuard() {
  const t = useTranslations("network");
  const {
    currentChainName,
    expectedChain,
    isSwitching,
    isWrongChain,
    switchToExpectedChain,
  } = useExpectedChain();
  const [error, setError] = useState<string | null>(null);

  if (!isWrongChain) return null;

  const switchNetwork = async () => {
    setError(null);
    try {
      await switchToExpectedChain();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || t("switchError", { chain: expectedChain.name }));
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-3xl md:bottom-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-error/20 bg-white p-4 shadow-[0_22px_70px_rgba(0,0,0,0.18)] md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-on-surface">{t("title")}</p>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant md:text-sm">
            {t("body", {
              current: currentChainName,
              expected: expectedChain.name,
            })}
          </p>
          {error && (
            <p className="mt-2 text-xs leading-5 text-error">
              {t("switchError", { chain: expectedChain.name })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void switchNetwork()}
          disabled={isSwitching}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-on-surface px-5 text-sm font-bold text-surface transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        >
          {isSwitching
            ? t("switching")
            : t("action", { chain: expectedChain.name })}
        </button>
      </div>
    </div>
  );
}
