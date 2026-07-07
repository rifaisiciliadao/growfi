"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Nav } from "./Nav";
import { RotatingHighlight } from "./RotatingHighlight";

const HERO_EXAMPLES_COUNT = 5;

export function Hero() {
  const t = useTranslations("landing.hero");

  return (
    <section
      id="home"
      className="relative min-h-[600px] w-full overflow-hidden md:min-h-[625px] lg:min-h-[650px]"
    >
      <div className="relative z-10 flex flex-col">
        <Nav />
        <div className="flex flex-col items-center px-6 pb-14 pt-7 text-center md:pb-16 md:pt-9">
          <Link href="/investors" className="animate-fade-rise mb-7 inline-block">
            <span className="animate-float-soft inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/85 px-4 py-1.5 text-xs font-bold tracking-[0.1em] text-[#1f2d1f] uppercase backdrop-blur-md shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <span className="relative inline-block h-1.5 w-1.5">
                <span
                  className="absolute inset-0 rounded-full"
                  style={{ background: "#00873a" }}
                />
                <span
                  className="animate-live-ring absolute inset-0 rounded-full"
                  style={{ background: "#00873a" }}
                />
              </span>
              {t("badge")}
            </span>
          </Link>

          <h1
            className="animate-fade-rise max-w-4xl font-sans text-[2.85rem] leading-[0.94] tracking-[-0.05em] text-black sm:text-[3.85rem] md:text-[4.7rem] lg:text-[5.05rem]"
            style={{
              textShadow: "0 1px 0 rgba(255,255,255,0.4)",
            }}
          >
            <span className="block font-extrabold">{t("titleA")}</span>
            <span className="block font-semibold text-black/90">
              {t("titleB")}
            </span>
          </h1>

          <p
            className="animate-fade-rise-delay mt-7 max-w-2xl text-lg font-semibold leading-snug text-black sm:text-xl"
            style={{
              textShadow: "0 1px 0 rgba(255,255,255,0.4)",
            }}
          >
            {t("lead")}
          </p>

          <p
            className="animate-fade-rise-delay mt-4 max-w-2xl text-base leading-7 text-[#1f2d1f] sm:text-lg"
            style={{
              textShadow: "0 1px 0 rgba(255,255,255,0.4)",
            }}
          >
            {t("subtitle1")} <RotatingHighlight count={HERO_EXAMPLES_COUNT} />{" "}
            {t("subtitle2")}
          </p>

          <div className="animate-fade-rise-delay-2 mt-10 flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
            <a
              href="/campaigns"
              className="shimmer-host group relative inline-flex items-center gap-2 rounded-full bg-black px-14 py-5 text-base font-bold text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_16px_40px_-10px_rgba(0,0,0,0.55)]"
              style={{ fontFamily: "var(--font-header)" }}
            >
              <span className="relative z-10 inline-flex items-center gap-2">
                {t("ctaFund")}
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
              </span>
            </a>
            <a
              href="#how"
              className="shimmer-host shimmer-host-dark inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/70 px-10 py-5 text-base font-bold text-black backdrop-blur-md transition-all duration-300 hover:bg-white"
              style={{ fontFamily: "var(--font-header)" }}
            >
              {t("ctaHow")}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
