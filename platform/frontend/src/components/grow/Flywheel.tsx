"use client";

import { useTranslations } from "next-intl";

/**
 * /grow flywheel — 2×2 cyclic diagram explaining how participation feeds the
 * Treasury, the Treasury feeds the campaigns, the campaigns feed back yield,
 * and the yield feeds $GROW stakers — closing the loop.
 *
 * Reading order: top-left → top-right → bottom-right → bottom-left → loops back.
 */
export function Flywheel() {
  const t = useTranslations("grow.flywheel");

  const steps = [
    {
      n: "01",
      title: t("s1.title"),
      body: t("s1.body"),
      // Top-left.
      pos: "tl" as const,
    },
    {
      n: "02",
      title: t("s2.title"),
      body: t("s2.body"),
      pos: "tr" as const,
    },
    {
      n: "03",
      title: t("s3.title"),
      body: t("s3.body"),
      pos: "br" as const,
    },
    {
      n: "04",
      title: t("s4.title"),
      body: t("s4.body"),
      pos: "bl" as const,
    },
  ];

  return (
    <section className="mt-10 rounded-[8px] border border-emerald-950/10 bg-[#06140f] p-5 text-white shadow-[0_30px_80px_-55px_rgba(6,20,15,0.7)] md:p-8">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-emerald-50/70 md:text-base">
            {t("subtitle")}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {steps.map((s) => (
            <article
              key={s.n}
              className="rounded-[8px] border border-white/10 bg-white/[0.055] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-emerald-300/40 hover:bg-white/[0.08]"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="font-mono text-xs font-semibold text-emerald-300">
                  {s.n}
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <h3 className="text-base font-semibold text-white md:text-lg">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-emerald-50/65">{s.body}</p>
            </article>
          ))}
        </div>
      </div>

      <p className="mt-6 border-t border-white/10 pt-4 text-xs leading-5 text-emerald-50/55">
        {t("footnote")}
      </p>
    </section>
  );
}
