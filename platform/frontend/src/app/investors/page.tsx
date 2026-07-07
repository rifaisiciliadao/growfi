"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CHAIN_ID, getAddresses } from "@/contracts";
import { requestInvestorDemo } from "@/lib/api";
import { addressUrl } from "@/lib/explorer";
import { SUBGRAPH_URL, useGlobalStats } from "@/lib/subgraph";

type FormState = "idle" | "submitting" | "ok" | "error";

const DECK_HREF = "/growfi-seed-deck.pdf";

export default function InvestorsPage() {
  const t = useTranslations("investors");
  const addresses = getAddresses(CHAIN_ID);
  const { data: globalStats } = useGlobalStats();
  const isMainnet = CHAIN_ID === 1;
  const chainText = (key: string) => t(isMainnet ? key : `${key}Testnet`);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    role: "",
    message: "",
    website: "",
  });
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState("");
  const campaignValue =
    typeof globalStats?.campaignCount === "number"
      ? t("stats.campaigns.valueWithCount", {
          count: globalStats.campaignCount,
        })
      : t("stats.campaigns.value");

  const stats = [
    {
      label: t("stats.protocol.label"),
      value: chainText("stats.protocol.value"),
      hint: chainText("stats.protocol.hint"),
    },
    {
      label: t("stats.campaigns.label"),
      value: campaignValue,
      hint: chainText("stats.campaigns.hint"),
    },
    {
      label: t("stats.treasury.label"),
      value: t("stats.treasury.value"),
      hint: chainText("stats.treasury.hint"),
    },
  ];

  const proofCards = [
    {
      label: t("proof.network.label"),
      value: chainText("proof.network.value"),
      hint: chainText("proof.network.hint"),
    },
    {
      label: t("proof.factory.label"),
      value: shortAddress(addresses.factory),
      hint: chainText("proof.factory.hint"),
      href: addressUrl(addresses.factory, CHAIN_ID),
    },
    {
      label: t("proof.indexer.label"),
      value: t("proof.indexer.value"),
      hint: chainText("proof.indexer.hint"),
      href: SUBGRAPH_URL,
    },
  ];

  const thesis = [
    t("thesis.items.market"),
    t("thesis.items.protocol"),
    t("thesis.items.distribution"),
  ];

  const mainnetReasons = [
    chainText("mainnet.items.security"),
    chainText("mainnet.items.settlement"),
    chainText("mainnet.items.credibility"),
  ];

  const milestones = [
    {
      phase: t("milestones.product.phase"),
      title: chainText("milestones.product.title"),
      body: chainText("milestones.product.body"),
    },
    {
      phase: t("milestones.supply.phase"),
      title: chainText("milestones.supply.title"),
      body: chainText("milestones.supply.body"),
    },
    {
      phase: t("milestones.seed.phase"),
      title: chainText("milestones.seed.title"),
      body: chainText("milestones.seed.body"),
    },
  ];

  const growPoints = [
    {
      label: t("grow.items.treasury.label"),
      body: t("grow.items.treasury.body"),
    },
    {
      label: t("grow.items.staking.label"),
      body: t("grow.items.staking.body"),
    },
    {
      label: t("grow.items.allocation.label"),
      body: t("grow.items.allocation.body"),
    },
  ];

  const feeRows = [
    "campaignBuy",
    "harvestDeposit",
    "repayment",
    "ecommerce",
  ].map((key) => ({
    flow: t(`fees.rows.${key}.flow`),
    percent: t(`fees.rows.${key}.percent`),
    applies: t(`fees.rows.${key}.applies`),
    route: t(`fees.rows.${key}.route`),
  }));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    setError("");
    try {
      await requestInvestorDemo(form);
      setState("ok");
      setForm({
        name: "",
        email: "",
        company: "",
        role: "",
        message: "",
        website: "",
      });
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : t("form.error"));
    }
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <section className="mx-auto max-w-7xl px-6 pb-10 pt-16 md:px-8 md:pb-12 md:pt-20">
        <div className="grid gap-8 lg:grid-cols-[0.86fr_0.52fr] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-outline-variant/35 bg-white/72 px-3 py-1 text-xs font-bold uppercase tracking-[0.13em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_0_5px_rgba(0,111,51,0.12)]" />
              {chainText("hero.kicker")}
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl font-extrabold leading-[0.94] tracking-[-0.065em] text-on-surface sm:text-6xl md:text-7xl">
              {t("hero.title")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-on-surface-variant">
              {chainText("hero.body")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#investor-request"
                className="app-control inline-flex min-h-12 items-center justify-center rounded-full bg-on-surface px-6 text-sm font-bold text-white hover:bg-black"
              >
                {t("hero.requestCta")}
              </a>
              <Link
                href="/campaigns"
                className="app-control inline-flex min-h-12 items-center justify-center rounded-full border border-outline-variant/35 bg-white/75 px-6 text-sm font-bold text-on-surface hover:bg-white"
              >
                {t("hero.campaignCta")}
              </Link>
            </div>
          </div>
          <aside className="app-card rounded-[1.35rem] p-5 md:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t("proof.kicker")}
            </p>
            <div className="mt-4 grid gap-3">
              {proofCards.map((card) => {
                const content = (
                  <>
                    <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-on-surface-variant">
                      {card.label}
                    </div>
                    <div className="mt-1 text-lg font-bold tracking-[-0.035em] text-on-surface">
                      {card.value}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                      {card.hint}
                    </p>
                  </>
                );

                return card.href ? (
                  <a
                    key={card.label}
                    href={card.href}
                    target="_blank"
                    rel="noreferrer"
                    className="app-control block rounded-[1rem] border border-outline-variant/28 bg-surface-container-low/72 p-4 hover:bg-white"
                  >
                    {content}
                  </a>
                ) : (
                  <div
                    key={card.label}
                    className="rounded-[1rem] border border-outline-variant/28 bg-surface-container-low/72 p-4"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </aside>
        </div>

        <div className="app-card mt-10 grid grid-cols-1 overflow-hidden rounded-[1.35rem] p-1 md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="border-outline-variant/18 px-5 py-5 md:border-r md:px-6 md:last:border-r-0">
              <div className="text-xs font-bold uppercase tracking-[0.13em] text-on-surface-variant">
                {stat.label}
              </div>
              <div className="mt-2 text-2xl font-bold tracking-[-0.04em] text-on-surface md:text-3xl">
                {stat.value}
              </div>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">{stat.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-[0.82fr_1fr] md:px-8 md:py-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {chainText("mainnet.kicker")}
            </p>
            <h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-[-0.055em] text-on-surface md:text-5xl">
              {chainText("mainnet.title")}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-on-surface-variant">
              {chainText("mainnet.body")}
            </p>
          </div>
          <div className="grid gap-3">
            {mainnetReasons.map((item, index) => (
              <div
                key={item}
                className="app-card grid grid-cols-[44px_1fr] gap-4 rounded-[1.15rem] p-5"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                  {index + 1}
                </div>
                <p className="text-base leading-7 text-on-surface-variant">{item}</p>
              </div>
            ))}
          </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-[0.9fr_1.1fr] md:px-8 md:py-16">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            {t("thesis.kicker")}
          </p>
          <h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-[-0.055em] text-on-surface md:text-5xl">
            {t("thesis.title")}
          </h2>
        </div>
        <div className="grid gap-4">
          {thesis.map((item, index) => (
            <div
              key={item}
              className="grid grid-cols-[44px_1fr] gap-4 border-t border-outline-variant/25 pt-5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-on-surface text-sm font-bold text-white">
                {index + 1}
              </div>
              <p className="text-base leading-7 text-on-surface-variant">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-14 md:grid-cols-[0.72fr_1.28fr] md:px-8 md:py-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t("fees.kicker")}
            </p>
            <h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-[-0.055em] text-on-surface md:text-5xl">
              {t("fees.title")}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-on-surface-variant">
              {t("fees.body")}
            </p>
          </div>
          <div className="app-card overflow-hidden rounded-[1.35rem]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-outline-variant/20 px-5 py-3 text-xs font-bold uppercase tracking-[0.13em] text-on-surface-variant">
                      {t("fees.headers.flow")}
                    </th>
                    <th className="border-b border-outline-variant/20 px-5 py-3 text-xs font-bold uppercase tracking-[0.13em] text-on-surface-variant">
                      {t("fees.headers.percent")}
                    </th>
                    <th className="border-b border-outline-variant/20 px-5 py-3 text-xs font-bold uppercase tracking-[0.13em] text-on-surface-variant">
                      {t("fees.headers.applies")}
                    </th>
                    <th className="border-b border-outline-variant/20 px-5 py-3 text-xs font-bold uppercase tracking-[0.13em] text-on-surface-variant">
                      {t("fees.headers.route")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {feeRows.map((row) => (
                    <tr
                      key={row.flow}
                      className="border-b border-outline-variant/15 align-top last:border-b-0"
                    >
                      <th className="px-5 py-4 text-sm font-bold text-on-surface">
                        {row.flow}
                      </th>
                      <td className="px-5 py-4 font-mono text-base font-bold text-primary">
                        {row.percent}
                      </td>
                      <td className="px-5 py-4 leading-6 text-on-surface-variant">
                        {row.applies}
                      </td>
                      <td className="px-5 py-4 leading-6 text-on-surface-variant">
                        {row.route}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      </section>

      <section className="mx-auto px-6 py-14 md:px-8 md:py-16">
          <div className="mx-auto mb-8 max-w-7xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t("milestones.kicker")}
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight tracking-[-0.055em] text-on-surface md:text-5xl">
              {chainText("milestones.title")}
            </h2>
          </div>
          <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-3">
            {milestones.map((item) => (
              <article
                key={item.phase}
                className="app-card rounded-[1.35rem] p-6"
              >
                <p className="text-xs font-bold uppercase tracking-[0.13em] text-primary">
                  {item.phase}
                </p>
                <h3 className="mt-4 text-2xl font-bold leading-tight tracking-[-0.04em] text-on-surface">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-[0.78fr_1fr] md:px-8 md:py-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t("grow.kicker")}
            </p>
            <h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-[-0.055em] text-on-surface md:text-5xl">
              {t("grow.title")}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-on-surface-variant">
              {t("grow.body")}
            </p>
            <a
              href="/grow"
              className="app-control mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-on-surface px-6 text-sm font-bold text-white hover:bg-black"
            >
              {t("grow.cta")}
            </a>
          </div>
          <div className="grid gap-4">
            {growPoints.map((item) => (
              <div key={item.label} className="app-card rounded-[1.15rem] p-5 md:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.13em] text-primary">
                  {item.label}
                </p>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
      </section>

      <section
        id="investor-request"
        className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-[0.82fr_1fr] md:px-8 md:py-16"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            {t("form.kicker")}
          </p>
          <h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-[-0.055em] text-on-surface md:text-5xl">
            {chainText("form.title")}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-on-surface-variant">
            {t("form.body")}
          </p>
          <a
            href={DECK_HREF}
            download
            className="app-control mt-8 inline-flex min-h-12 items-center justify-center rounded-full border border-outline-variant/35 bg-white/75 px-6 text-sm font-bold text-on-surface hover:bg-white"
          >
            {t("form.deck")}
          </a>
        </div>

        <form
          onSubmit={onSubmit}
          className="app-card rounded-[1.35rem] p-5 md:p-7"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.name")}>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
                className="h-11 w-full rounded-xl border border-outline-variant/35 bg-surface-container-low px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary"
              />
            </Field>
            <Field label={t("form.email")}>
              <input
                required
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
                className="h-11 w-full rounded-xl border border-outline-variant/35 bg-surface-container-low px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary"
              />
            </Field>
            <Field label={t("form.company")}>
              <input
                value={form.company}
                onChange={(e) =>
                  setForm((v) => ({ ...v, company: e.target.value }))
                }
                className="h-11 w-full rounded-xl border border-outline-variant/35 bg-surface-container-low px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary"
              />
            </Field>
            <Field label={t("form.role")}>
              <input
                value={form.role}
                onChange={(e) => setForm((v) => ({ ...v, role: e.target.value }))}
                className="h-11 w-full rounded-xl border border-outline-variant/35 bg-surface-container-low px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary"
              />
            </Field>
          </div>

          <label className="sr-only" htmlFor="website">
            Website
          </label>
          <input
            id="website"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => setForm((v) => ({ ...v, website: e.target.value }))}
            className="hidden"
          />

          <Field label={t("form.message")} className="mt-4">
            <textarea
              required
              value={form.message}
              onChange={(e) =>
                setForm((v) => ({ ...v, message: e.target.value }))
              }
              className="min-h-[150px] w-full resize-y rounded-xl border border-outline-variant/35 bg-surface-container-low px-3 py-3 text-sm leading-6 text-on-surface outline-none transition-colors focus:border-primary"
            />
          </Field>

          <button
            type="submit"
            disabled={state === "submitting"}
            className="app-control mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-on-surface px-6 text-sm font-bold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state === "submitting" ? t("form.submitting") : t("form.submit")}
          </button>

          <div aria-live="polite" className="min-h-8">
            {state === "ok" && (
              <p className="mt-4 rounded-[6px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                {t("form.success")}
              </p>
            )}
            {state === "error" && (
              <p className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                {error || t("form.error")}
              </p>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">
        {label}
      </span>
      {children}
    </label>
  );
}
