"use client";

import { useTranslations } from "next-intl";
import { useInView } from "@/lib/landing/useInView";

type Partner = {
  name: string;
  roleKey: "rifaiRole" | "silviRole";
  url: string;
  logoPath: string;
  logoHeight: number;
  rounded?: boolean;
};

const PARTNERS: Partner[] = [
  {
    name: "Rifai Sicilia",
    roleKey: "rifaiRole",
    url: "https://www.rifaisicilia.com/",
    logoPath: "/partners/rifai.jpg",
    logoHeight: 48,
    rounded: true,
  },
  {
    name: "Silvi",
    roleKey: "silviRole",
    url: "https://silvi.earth/",
    logoPath: "/partners/silvi.png",
    logoHeight: 36,
  },
];

export function Partners() {
  const t = useTranslations("landing.partners");
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section
      id="partners"
      className="glass-section relative w-full py-24 md:py-32"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.5)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
      }}
    >
      <div ref={ref} className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="mb-12 max-w-2xl md:mb-16">
          <span
            className={`reveal ${inView ? "in-view" : ""} mb-4 inline-block text-xs font-bold tracking-[0.18em] uppercase`}
            style={{ color: "#1a1a1a", fontFamily: "var(--font-header)" }}
          >
            {t("kicker")}
          </span>
          <h2
            className={`reveal reveal-delay-1 ${inView ? "in-view" : ""} font-display text-4xl sm:text-5xl`}
            style={{ color: "#000000", lineHeight: "1.02" }}
          >
            {t("title1")} <em>{t("title2")}</em>
          </h2>
          <p
            className={`reveal reveal-delay-2 ${inView ? "in-view" : ""} mt-6 max-w-xl text-base leading-relaxed`}
            style={{ color: "#1a1a1a" }}
          >
            {t("intro")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {PARTNERS.map((p, i) => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`reveal reveal-delay-${Math.min(i + 3, 6)} ${inView ? "in-view" : ""} group flex flex-col rounded-2xl p-8 transition-all duration-500 hover:-translate-y-1`}
              style={{
                background: "rgba(255,255,255,0.72)",
                border: "1px solid rgba(255,255,255,0.75)",
                backdropFilter: "blur(14px) saturate(1.1)",
                WebkitBackdropFilter: "blur(14px) saturate(1.1)",
                boxShadow:
                  "0 1px 0 0 rgba(255,255,255,0.9) inset, 0 8px 24px -12px rgba(0,0,0,0.12)",
              }}
            >
              <div className="flex h-14 items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.logoPath}
                  alt={p.name}
                  style={{
                    height: p.logoHeight,
                    width: "auto",
                    borderRadius: p.rounded ? "50%" : 0,
                  }}
                />
              </div>
              <h3
                className="font-display mt-6 text-2xl leading-tight"
                style={{ color: "#000000" }}
              >
                {p.name}
              </h3>
              <p
                className="mt-2 max-w-md text-sm leading-relaxed"
                style={{ color: "#4a4a4a" }}
              >
                {t(p.roleKey)}
              </p>
              <span
                className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] transition-transform duration-300 group-hover:translate-x-0.5"
                style={{
                  fontFamily: "var(--font-header)",
                  color: "#000000",
                }}
              >
                {t("visit")}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7 17L17 7M17 7H8M17 7v9" />
                </svg>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
