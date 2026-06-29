"use client";

import { useTranslations } from "next-intl";

export function SocialVerificationBadge({
  verified,
  size = 14,
  className,
}: {
  verified: boolean | undefined | null;
  size?: number;
  className?: string;
}) {
  const t = useTranslations("socialVerification");
  if (!verified) return null;

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
