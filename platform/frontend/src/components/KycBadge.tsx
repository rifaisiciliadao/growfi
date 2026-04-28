"use client";

import { useTranslations } from "next-intl";

/**
 * Tiny round badge for KYC-verified producers. Renders a filled green
 * disc with a white check inside; sits inline next to a producer's name
 * (sidebar card on /campaign, hero on /producer/[address], rows in
 * InvestorList). The wrapper carries an `aria-label` + native `title` so
 * hover surfaces "KYC verified" on every browser without bringing in a
 * tooltip lib for one widget.
 *
 * Strictly opt-in via the `kyced` prop — wired directly to the on-chain
 * `Producer.kyced` flag from the subgraph. Profile presence alone is NOT
 * sufficient (the contract makes producers unable to self-attest, so the
 * UI must mirror that trust boundary).
 */
export function KycBadge({
  kyced,
  size = 14,
  className,
}: {
  kyced: boolean | undefined | null;
  size?: number;
  className?: string;
}) {
  const t = useTranslations("kyc");
  if (!kyced) return null;

  const label = t("verified");

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-full bg-primary text-white shrink-0 ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={Math.round(size * 0.6)}
        height={Math.round(size * 0.6)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12.5L10 17.5L19 7.5" />
      </svg>
    </span>
  );
}
