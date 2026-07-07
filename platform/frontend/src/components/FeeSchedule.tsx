"use client";

import { useTranslations } from "next-intl";

type FeeScheduleProps = {
  variant?: "light" | "dark";
};

const FEE_ROW_KEYS = [
  "campaignBuy",
  "harvestDeposit",
  "repayment",
  "ecommerce",
  "growDirect",
] as const;

export function FeeSchedule({ variant = "light" }: FeeScheduleProps) {
  const t = useTranslations("landing.trust");
  const dark = variant === "dark";
  const rows = FEE_ROW_KEYS.map((key) => ({
    flow: t(`feeTable.rows.${key}.flow`),
    percent: t(`feeTable.rows.${key}.percent`),
    applies: t(`feeTable.rows.${key}.applies`),
    route: t(`feeTable.rows.${key}.route`),
  }));

  return (
    <div
      className={`overflow-hidden rounded-[8px] border ${
        dark
          ? "border-white/[0.14] bg-white/[0.045]"
          : "app-card border-outline-variant/30"
      }`}
    >
      <div
        className={`border-b px-5 py-4 md:px-6 ${
          dark ? "border-white/10" : "border-outline-variant/20"
        }`}
      >
        <p
          className={`text-xs font-bold uppercase tracking-[0.18em] ${
            dark ? "text-white/70" : "text-primary"
          }`}
        >
          {t("feeTable.kicker")}
        </p>
        <h3
          className={`mt-2 text-2xl font-bold tracking-[-0.035em] ${
            dark ? "text-white" : "text-on-surface"
          }`}
        >
          {t("feeTable.title")}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className={dark ? "border-b border-white/10" : "border-b border-outline-variant/20"}>
              <th className={`px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] md:px-6 ${dark ? "text-white/62" : "text-on-surface-variant"}`}>
                {t("feeTable.headers.flow")}
              </th>
              <th className={`px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] md:px-6 ${dark ? "text-white/62" : "text-on-surface-variant"}`}>
                {t("feeTable.headers.percent")}
              </th>
              <th className={`px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] md:px-6 ${dark ? "text-white/62" : "text-on-surface-variant"}`}>
                {t("feeTable.headers.applies")}
              </th>
              <th className={`px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] md:px-6 ${dark ? "text-white/62" : "text-on-surface-variant"}`}>
                {t("feeTable.headers.route")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.flow}
                className={dark ? "border-b border-white/10 last:border-b-0" : "border-b border-outline-variant/15 last:border-b-0"}
              >
                <th className={`px-5 py-4 font-semibold md:px-6 ${dark ? "text-white" : "text-on-surface"}`}>
                  {row.flow}
                </th>
                <td className="px-5 py-4 font-mono text-base font-semibold text-[#00a84f] md:px-6">
                  {row.percent}
                </td>
                <td className={`px-5 py-4 leading-6 md:px-6 ${dark ? "text-white/80" : "text-on-surface-variant"}`}>
                  {row.applies}
                </td>
                <td className={`px-5 py-4 leading-6 md:px-6 ${dark ? "text-white/80" : "text-on-surface-variant"}`}>
                  {row.route}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
