"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="bg-slate-950 w-full mt-20">
      <div className="flex flex-col md:flex-row justify-between items-center px-4 md:px-8 py-10 md:py-12 max-w-7xl mx-auto gap-6 md:gap-0">
        <div className="text-center md:text-left">
          <span className="text-lg font-bold text-white tracking-tight">
            GrowFi
          </span>
          <p className="text-sm text-slate-400 mt-2">{t("tagline", { year })}</p>
        </div>
        <div className="flex flex-wrap justify-center md:justify-end gap-x-2 gap-y-1">
          <Link
            href="/campaigns"
            prefetch={false}
            className="inline-flex items-center min-h-[44px] px-3 text-sm font-semibold text-white hover:text-emerald-300 transition-colors"
          >
            {t("campaigns")}
          </Link>
          <Link
            href="/investors"
            prefetch={false}
            className="inline-flex items-center min-h-[44px] px-3 text-sm font-semibold text-white hover:text-emerald-300 transition-colors"
          >
            {t("investors")}
          </Link>
          <Link
            href="/grow"
            prefetch={false}
            className="inline-flex items-center min-h-[44px] px-3 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            $GROW
          </Link>
          <Link
            href="/faq"
            prefetch={false}
            className="inline-flex items-center min-h-[44px] px-3 text-sm text-slate-400 hover:text-green-400 transition-colors"
          >
            {t("faq")}
          </Link>
          <a
            href="https://github.com/rifaisiciliadao/growfi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center min-h-[44px] px-3 text-sm text-slate-400 hover:text-green-400 transition-colors"
          >
            {t("github")}
          </a>
        </div>
      </div>
    </footer>
  );
}
