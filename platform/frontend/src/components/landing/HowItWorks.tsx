"use client";

import { useTranslations } from "next-intl";
import { useInView } from "@/lib/landing/useInView";

const STEP_NUMBERS = ["01", "02", "03", "04"];

export function HowItWorks() {
  const t = useTranslations("landing.how");
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section
      id="how"
      className="relative isolate w-full overflow-hidden bg-[#f7f8f1] pb-24 pt-12 md:pb-28 md:pt-14"
      style={{
        borderTop: "1px solid rgba(6,27,49,0.08)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.78)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(6,27,49,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(6,27,49,0.1) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      <div ref={ref} className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span
            className={`reveal ${inView ? "in-view" : ""} mb-5 inline-block text-xs font-bold uppercase tracking-[0.18em]`}
            style={{ color: "#1f5132", fontFamily: "var(--font-header)" }}
          >
            {t("kicker")}
          </span>
          <h2
            className={`reveal reveal-delay-1 ${inView ? "in-view" : ""} font-display text-4xl leading-[0.98] text-[#061b31] sm:text-5xl md:text-6xl`}
          >
            <span className="block">{t("title1")}</span>
            <span className="block">{t("title2")}</span>
          </h2>
          <p
            className={`reveal reveal-delay-2 ${inView ? "in-view" : ""} mt-6 text-lg leading-8`}
            style={{ color: "#30445d" }}
          >
            {t("intro")}
          </p>
        </div>

        <div className="mt-14">
          <ol className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
            {STEP_NUMBERS.map((n, i) => (
              <li
                key={n}
                className={`reveal reveal-delay-${Math.min(i + 1, 6)} ${inView ? "in-view" : ""} app-card min-h-[17rem] rounded-[1.35rem] p-6 md:p-7`}
              >
                <div
                  className="font-mono text-sm font-bold leading-none text-[#1f7a3c]"
                  aria-hidden="true"
                >
                  {n}
                </div>
                <p
                  className="mt-8 text-xs font-bold uppercase tracking-[0.18em]"
                  style={{
                    color: "#1f7a3c",
                    fontFamily: "var(--font-header)",
                  }}
                >
                  {t(`steps.${i}.signal`)}
                </p>
                <h3 className="font-display mt-3 text-2xl leading-tight text-[#061b31]">
                  {t(`steps.${i}.title`)}
                </h3>
                <p className="mt-4 text-base leading-7 text-[#42556e]">
                  {t(`steps.${i}.body`)}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-10 flex flex-col items-center gap-6 text-center">
          <div className="flex flex-wrap gap-3">
            <a
              href="/campaigns"
              className={`reveal reveal-delay-2 ${inView ? "in-view" : ""} group inline-flex shrink-0 items-center gap-2 rounded-full bg-[#061b31] px-7 py-3.5 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-18px_rgba(6,27,49,0.8)]`}
              style={{ fontFamily: "var(--font-header)" }}
            >
              {t("ctaSee")}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
