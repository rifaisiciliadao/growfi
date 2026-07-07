"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { FeeSchedule } from "@/components/FeeSchedule";

const FAQ_ITEMS = [
  "participate",
  "campaignFunds",
  "softCap",
  "yieldToken",
  "growToken",
  "projectUpdates",
  "split",
  "silvi",
] as const;

export default function FaqPage() {
  const t = useTranslations("faq");
  const tCampaigns = useTranslations("landing.campaigns");

  return (
    <div className="min-h-screen bg-surface">
      <section className="mx-auto max-w-7xl px-6 pb-14 pt-16 md:px-8 md:pt-20">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          {t("kicker")}
        </p>
        <div className="mt-5 grid gap-8 lg:grid-cols-[0.82fr_0.48fr] lg:items-end">
          <div>
            <h1 className="max-w-4xl text-5xl font-extrabold leading-[0.95] tracking-[-0.065em] text-on-surface sm:text-6xl md:text-7xl">
              {t("title")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-on-surface-variant">
              {t("intro")}
            </p>
          </div>
          <Link
            href="/campaigns"
            className="app-control inline-flex min-h-12 items-center justify-center rounded-full bg-on-surface px-6 text-sm font-bold text-white hover:bg-black"
          >
            {t("campaignsCta")}
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-10 md:px-8">
        <FeeSchedule />
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-6 pb-10 md:grid-cols-2 md:px-8">
        {FAQ_ITEMS.map((key) => (
          <article key={key} className="app-card rounded-[1.35rem] p-6 md:p-7">
            <h2 className="text-xl font-bold tracking-[-0.035em] text-on-surface">
              {t(`items.${key}.title`)}
            </h2>
            <p className="mt-3 text-base leading-7 text-on-surface-variant">
              {t(`items.${key}.body`)}
            </p>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24 md:px-8">
        <div className="app-card flex flex-col gap-5 rounded-[1.35rem] p-6 md:flex-row md:items-center md:justify-between md:p-7">
          <div>
            <h2 className="text-xl font-bold tracking-[-0.035em] text-on-surface">
              {tCampaigns("createTitle")}
            </h2>
            <p className="mt-2 max-w-2xl text-base leading-7 text-on-surface-variant">
              {tCampaigns("createBody")}
            </p>
          </div>
          <Link
            href="/create"
            className="app-control inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-on-surface px-6 text-sm font-bold text-white hover:bg-black"
          >
            {tCampaigns("createCta")}
          </Link>
        </div>
      </section>
    </div>
  );
}
