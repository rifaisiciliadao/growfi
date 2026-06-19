"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CHAIN_ID, getAddresses } from "@/contracts";
import { requestInvestorDemo } from "@/lib/api";
import { addressUrl } from "@/lib/explorer";
import { useGlobalStats } from "@/lib/subgraph";

type FormState = "idle" | "submitting" | "ok" | "error";

const HERO_IMAGE = "/investors-olive-hero.jpg";
const DECK_HREF = "/growfi-seed-deck.pdf";

export default function InvestorsPage() {
  const t = useTranslations("investors");
  const addresses = getAddresses(CHAIN_ID);
  const { data: globalStats } = useGlobalStats();
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
      value: t("stats.protocol.value"),
      hint: t("stats.protocol.hint"),
    },
    {
      label: t("stats.campaigns.label"),
      value: campaignValue,
      hint: t("stats.campaigns.hint"),
    },
    {
      label: t("stats.treasury.label"),
      value: t("stats.treasury.value"),
      hint: t("stats.treasury.hint"),
    },
  ];

  const proofCards = [
    {
      label: t("proof.network.label"),
      value: t("proof.network.value"),
      hint: t("proof.network.hint"),
    },
    {
      label: t("proof.factory.label"),
      value: shortAddress(addresses.factory),
      hint: t("proof.factory.hint"),
      href: addressUrl(addresses.factory, CHAIN_ID),
    },
    {
      label: t("proof.indexer.label"),
      value: t("proof.indexer.value"),
      hint: t("proof.indexer.hint"),
      href: "https://ugraph.growfi.dev/subgraphs/growfi/latest/gn",
    },
  ];

  const thesis = [
    t("thesis.items.market"),
    t("thesis.items.protocol"),
    t("thesis.items.distribution"),
  ];

  const mainnetReasons = [
    t("mainnet.items.security"),
    t("mainnet.items.settlement"),
    t("mainnet.items.credibility"),
  ];

  const milestones = [
    {
      phase: t("milestones.product.phase"),
      title: t("milestones.product.title"),
      body: t("milestones.product.body"),
    },
    {
      phase: t("milestones.supply.phase"),
      title: t("milestones.supply.title"),
      body: t("milestones.supply.body"),
    },
    {
      phase: t("milestones.seed.phase"),
      title: t("milestones.seed.title"),
      body: t("milestones.seed.body"),
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
    "growDirect",
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
    <div className="bg-[#f6f8f2] text-[#061b31]">
      <section className="relative isolate overflow-hidden bg-[#06140f] text-white">
        <img
          src={HERO_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,17,13,0.96)_0%,rgba(5,17,13,0.84)_38%,rgba(5,17,13,0.28)_76%,rgba(5,17,13,0.06)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(0deg,rgba(6,20,15,0.92),rgba(6,20,15,0))]" />
        <div className="absolute left-0 top-0 h-full w-full bg-[radial-gradient(circle_at_14%_24%,rgba(83,58,253,0.24),transparent_28%),radial-gradient(circle_at_88%_72%,rgba(127,252,151,0.20),transparent_24%)]" />
        <div className="relative mx-auto grid min-h-[760px] max-w-7xl items-end gap-8 px-4 pb-10 pt-28 md:grid-cols-[1fr_420px] md:px-8 md:pb-14">
          <div className="max-w-4xl pb-4 md:pb-8">
            <p className="inline-flex items-center gap-2 rounded-[4px] border border-white/20 bg-white/12 px-3 py-1 text-xs font-semibold uppercase text-emerald-100 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7ffc97] shadow-[0_0_0_5px_rgba(127,252,151,0.16)]" />
              {t("hero.kicker")}
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[1.02] text-white md:text-7xl">
              {t("hero.title")}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-emerald-50/88 md:text-lg">
              {t("hero.body")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#investor-request"
                className="inline-flex min-h-[46px] items-center justify-center rounded-[6px] bg-white px-5 text-sm font-semibold text-[#06140f] transition-colors hover:bg-emerald-50"
              >
                {t("hero.requestCta")}
              </a>
              <Link
                href="/#campaigns"
                className="inline-flex min-h-[46px] items-center justify-center rounded-[6px] border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/16"
              >
                {t("hero.campaignCta")}
              </Link>
            </div>
          </div>
          <aside className="rounded-[8px] border border-white/16 bg-[#061b31]/70 p-4 shadow-[0_30px_60px_-34px_rgba(0,0,0,0.70)] backdrop-blur-xl md:mb-8">
            <p className="text-xs font-semibold uppercase text-emerald-200">
              {t("proof.kicker")}
            </p>
            <div className="mt-4 grid gap-3">
              {proofCards.map((card) => {
                const content = (
                  <>
                    <div className="text-[11px] font-semibold uppercase text-white/52">
                      {card.label}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {card.value}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-300">
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
                    className="block rounded-[6px] border border-white/10 bg-white/[0.06] p-4 transition-colors hover:bg-white/[0.1]"
                  >
                    {content}
                  </a>
                ) : (
                  <div
                    key={card.label}
                    className="rounded-[6px] border border-white/10 bg-white/[0.06] p-4"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </section>

      <section className="relative z-10 -mt-8 px-4 md:px-8">
        <div className="mx-auto grid max-w-7xl grid-cols-1 overflow-hidden rounded-[8px] border border-[#e5edf5] bg-emerald-950/10 shadow-[0_30px_45px_-32px_rgba(50,50,93,0.36),0_18px_36px_-26px_rgba(0,0,0,0.16)] md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white px-5 py-6 md:px-6">
              <div className="text-xs font-semibold uppercase text-[#64748d]">
                {stat.label}
              </div>
              <div className="mt-2 text-3xl font-semibold text-[#061b31]">
                {stat.value}
              </div>
              <p className="mt-2 text-sm leading-6 text-[#64748d]">{stat.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#061b31] text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-[0.82fr_1fr] md:px-8 md:py-24">
          <div>
            <p className="text-xs font-semibold uppercase text-emerald-200">
              {t("mainnet.kicker")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight md:text-5xl">
              {t("mainnet.title")}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
              {t("mainnet.body")}
            </p>
          </div>
          <div className="border-y border-white/12">
            {mainnetReasons.map((item, index) => (
              <div
                key={item}
                className="grid grid-cols-[44px_1fr] gap-4 border-b border-white/12 py-5 last:border-b-0"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-[6px] bg-white text-sm font-semibold text-[#061b31]">
                  {index + 1}
                </div>
                <p className="text-base leading-7 text-slate-200">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-[0.9fr_1.1fr] md:px-8 md:py-20">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-700">
            {t("thesis.kicker")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#061b31] md:text-5xl">
            {t("thesis.title")}
          </h2>
        </div>
        <div className="grid gap-4">
          {thesis.map((item, index) => (
            <div
              key={item}
              className="grid grid-cols-[44px_1fr] gap-4 border-t border-emerald-950/10 pt-5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-[6px] bg-emerald-950 text-sm font-semibold text-white">
                {index + 1}
              </div>
              <p className="text-base leading-7 text-[#273951]">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 md:grid-cols-[0.72fr_1.28fr] md:px-8 md:py-20">
          <div>
            <p className="text-xs font-semibold uppercase text-emerald-700">
              {t("fees.kicker")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#061b31] md:text-5xl">
              {t("fees.title")}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#64748d]">
              {t("fees.body")}
            </p>
          </div>
          <div className="overflow-hidden rounded-[8px] border border-[#e5edf5] shadow-[0_30px_45px_-34px_rgba(50,50,93,0.34),0_18px_36px_-30px_rgba(0,0,0,0.14)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse bg-white text-left text-sm">
                <thead className="bg-[#061b31] text-white">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase">
                      {t("fees.headers.flow")}
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase">
                      {t("fees.headers.percent")}
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase">
                      {t("fees.headers.applies")}
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase">
                      {t("fees.headers.route")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {feeRows.map((row) => (
                    <tr
                      key={row.flow}
                      className="border-t border-[#e5edf5] align-top"
                    >
                      <th className="px-4 py-4 text-sm font-semibold text-[#061b31]">
                        {row.flow}
                      </th>
                      <td className="px-4 py-4 font-mono text-base font-semibold text-emerald-800">
                        {row.percent}
                      </td>
                      <td className="px-4 py-4 leading-6 text-[#42556e]">
                        {row.applies}
                      </td>
                      <td className="px-4 py-4 leading-6 text-[#42556e]">
                        {row.route}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#061b31] text-white">
        <div className="mx-auto px-4 py-16 md:px-8 md:py-20">
          <div className="mx-auto mb-8 max-w-7xl">
            <p className="text-xs font-semibold uppercase text-emerald-200">
              {t("milestones.kicker")}
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight md:text-5xl">
              {t("milestones.title")}
            </h2>
          </div>
          <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-3">
            {milestones.map((item) => (
              <article
                key={item.phase}
                className="rounded-[8px] border border-white/12 bg-white/[0.04] p-6 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.55)]"
              >
                <p className="text-xs font-semibold uppercase text-emerald-200">
                  {item.phase}
                </p>
                <h3 className="mt-4 text-2xl font-semibold leading-tight">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-[0.78fr_1.22fr] md:px-8 md:py-20">
          <div>
            <p className="text-xs font-semibold uppercase text-emerald-700">
              {t("grow.kicker")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#061b31] md:text-5xl">
              {t("grow.title")}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#64748d]">
              {t("grow.body")}
            </p>
            <a
              href="/grow"
              className="mt-8 inline-flex min-h-[44px] items-center justify-center rounded-[6px] border border-emerald-900/20 bg-[#061b31] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0d253d]"
            >
              {t("grow.cta")}
            </a>
          </div>
          <div className="grid gap-px bg-emerald-950/10 sm:grid-cols-3">
            {growPoints.map((item) => (
              <div key={item.label} className="bg-white p-5 md:p-6">
                <p className="text-xs font-semibold uppercase text-emerald-700">
                  {item.label}
                </p>
                <p className="mt-3 text-sm leading-6 text-[#42556e]">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="investor-request"
        className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-[0.82fr_1fr] md:px-8 md:py-20"
      >
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-700">
            {t("form.kicker")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#061b31] md:text-5xl">
            {t("form.title")}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#64748d]">
            {t("form.body")}
          </p>
          <a
            href={DECK_HREF}
            download
            className="mt-8 inline-flex min-h-[44px] items-center justify-center rounded-[6px] border border-emerald-900/20 bg-white px-5 text-sm font-semibold text-[#061b31] shadow-[0_16px_36px_-28px_rgba(50,50,93,0.45)] transition-colors hover:bg-emerald-50"
          >
            {t("form.deck")}
          </a>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-[8px] border border-[#e5edf5] bg-white p-5 shadow-[0_30px_45px_-34px_rgba(50,50,93,0.35),0_18px_36px_-30px_rgba(0,0,0,0.16)] md:p-7"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.name")}>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
                className="h-11 w-full rounded-[6px] border border-[#dbe5ee] px-3 text-sm text-[#061b31] outline-none transition-colors focus:border-emerald-700"
              />
            </Field>
            <Field label={t("form.email")}>
              <input
                required
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
                className="h-11 w-full rounded-[6px] border border-[#dbe5ee] px-3 text-sm text-[#061b31] outline-none transition-colors focus:border-emerald-700"
              />
            </Field>
            <Field label={t("form.company")}>
              <input
                value={form.company}
                onChange={(e) =>
                  setForm((v) => ({ ...v, company: e.target.value }))
                }
                className="h-11 w-full rounded-[6px] border border-[#dbe5ee] px-3 text-sm text-[#061b31] outline-none transition-colors focus:border-emerald-700"
              />
            </Field>
            <Field label={t("form.role")}>
              <input
                value={form.role}
                onChange={(e) => setForm((v) => ({ ...v, role: e.target.value }))}
                className="h-11 w-full rounded-[6px] border border-[#dbe5ee] px-3 text-sm text-[#061b31] outline-none transition-colors focus:border-emerald-700"
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
              className="min-h-[150px] w-full resize-y rounded-[6px] border border-[#dbe5ee] px-3 py-3 text-sm leading-6 text-[#061b31] outline-none transition-colors focus:border-emerald-700"
            />
          </Field>

          <button
            type="submit"
            disabled={state === "submitting"}
            className="mt-5 inline-flex min-h-[46px] w-full items-center justify-center rounded-[6px] bg-[#061b31] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0d253d] disabled:cursor-not-allowed disabled:opacity-60"
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
      <span className="mb-1.5 block text-xs font-semibold uppercase text-[#273951]">
        {label}
      </span>
      {children}
    </label>
  );
}
