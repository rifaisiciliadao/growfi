"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Logo } from "./Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useInviteGate } from "@/lib/inviteGate";
import { useExpectedChain } from "@/lib/useExpectedChain";

export function Header() {
  const t = useTranslations("nav");
  const tNetwork = useTranslations("network");
  const tInvite = useTranslations("landing.invite");
  const { state } = useInviteGate();
  const {
    expectedChain,
    isSwitching,
    isWrongChain,
    switchToExpectedChain,
  } = useExpectedChain();
  const approved = state === "approved";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mql.matches) {
        setMobileOpen(false);
      } else {
        setDesktopOpen(false);
      }
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!desktopOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (
        desktopMenuRef.current &&
        !desktopMenuRef.current.contains(event.target as Node)
      ) {
        setDesktopOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDesktopOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [desktopOpen]);

  const linkClass =
    "text-sm font-medium tracking-wide text-on-surface-variant hover:text-on-surface transition-colors";
  const menuLinkClass =
    "flex items-center rounded-md px-3 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors";
  const walletControl = (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        const pillBase =
          "h-10 px-3 md:px-4 rounded-full text-xs md:text-sm font-semibold bg-white border border-outline-variant/30 text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-2 whitespace-nowrap";

        return (
          <div className="flex items-center gap-2" aria-hidden={!ready}>
            {!connected ? (
              <button
                onClick={openConnectModal}
                type="button"
                className={pillBase}
              >
                <span className="hidden sm:inline">{t("connectWallet")}</span>
                <span className="sm:hidden">{t("connect")}</span>
              </button>
            ) : chain.unsupported ? (
              <button
                onClick={() => {
                  void switchToExpectedChain().catch(() => openChainModal?.());
                }}
                type="button"
                className="h-10 px-3 md:px-4 rounded-full text-xs md:text-sm font-semibold bg-error text-on-error flex items-center gap-2 whitespace-nowrap"
              >
                {isSwitching
                  ? tNetwork("switching")
                  : tNetwork("switchShort", { chain: expectedChain.name })}
              </button>
            ) : isWrongChain ? (
              <button
                onClick={() => {
                  void switchToExpectedChain().catch(() => openChainModal?.());
                }}
                type="button"
                className="h-10 px-3 md:px-4 rounded-full text-xs md:text-sm font-semibold bg-error text-on-error flex items-center gap-2 whitespace-nowrap"
              >
                {isSwitching
                  ? tNetwork("switching")
                  : tNetwork("switchShort", { chain: expectedChain.name })}
              </button>
            ) : (
              <Link
                href={`/grower/${account.address}`}
                prefetch={false}
                className={pillBase}
                title={t("profile")}
              >
                <span className="w-6 h-6 rounded-full bg-primary-fixed text-on-primary-fixed-variant flex items-center justify-center text-[10px] font-bold shrink-0">
                  {account.address.slice(2, 4).toUpperCase()}
                </span>
                <span className="hidden sm:inline font-mono text-xs">
                  {account.address.slice(0, 6)}…{account.address.slice(-4)}
                </span>
              </Link>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl border-b border-outline-variant/15">
      <div className="relative flex justify-between items-center px-4 md:px-8 h-16 max-w-7xl mx-auto w-full gap-2 md:gap-6">
        <Link href="/" prefetch={false} className="relative z-10 flex items-center gap-1 shrink-0 min-w-0">
          <Logo />
        </Link>

        <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-5 lg:flex">
          <Link href="/" prefetch={false} className={linkClass}>
            {t("explore")}
          </Link>
          <Link href="/investors" prefetch={false} className={linkClass}>
            {t("investors")}
          </Link>
          <Link href="/grow" prefetch={false} className={linkClass}>
            $GROW
          </Link>
        </div>

        <div className="relative z-10 flex items-center gap-2 shrink-0">
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>
          {walletControl}
          <div ref={desktopMenuRef} className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setDesktopOpen((v) => !v)}
              aria-label={desktopOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={desktopOpen}
              aria-haspopup="menu"
              title="Menu"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/30 bg-white text-on-surface hover:bg-surface-container-low transition-colors"
            >
              {desktopOpen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
            {desktopOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-60 rounded-lg border border-outline-variant/20 bg-white/95 p-1.5 shadow-[0_18px_48px_-28px_rgba(0,0,0,0.45)] backdrop-blur-xl"
              >
                <Link
                  href="/"
                  prefetch={false}
                  role="menuitem"
                  onClick={() => setDesktopOpen(false)}
                  className={`${menuLinkClass} lg:hidden`}
                >
                  {t("explore")}
                </Link>
                <Link
                  href="/investors"
                  prefetch={false}
                  role="menuitem"
                  onClick={() => setDesktopOpen(false)}
                  className={`${menuLinkClass} lg:hidden`}
                >
                  {t("investors")}
                </Link>
                <Link
                  href="/grow"
                  prefetch={false}
                  role="menuitem"
                  onClick={() => setDesktopOpen(false)}
                  className={`${menuLinkClass} font-semibold text-emerald-700 hover:text-emerald-800 lg:hidden`}
                >
                  $GROW
                </Link>
                <div className="my-1 h-px bg-outline-variant/15 lg:hidden" />
                <Link
                  href="/feed"
                  prefetch={false}
                  role="menuitem"
                  onClick={() => setDesktopOpen(false)}
                  className={menuLinkClass}
                >
                  {t("feed")}
                </Link>
                <Link
                  href="/portfolio"
                  prefetch={false}
                  role="menuitem"
                  onClick={() => setDesktopOpen(false)}
                  className={menuLinkClass}
                >
                  {t("portfolio")}
                </Link>
                {approved ? (
                  <Link
                    href="/create"
                    prefetch={false}
                    role="menuitem"
                    onClick={() => setDesktopOpen(false)}
                    className={menuLinkClass}
                  >
                    {t("create")}
                  </Link>
                ) : (
                  <Link
                    href="/?openInvite=1"
                    prefetch={false}
                    role="menuitem"
                    onClick={() => setDesktopOpen(false)}
                    className={menuLinkClass}
                  >
                    {tInvite("requestSubmit")}
                  </Link>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close mobile menu" : "Open mobile menu"}
            aria-expanded={mobileOpen}
            className="md:hidden flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/30 bg-white text-on-surface hover:bg-surface-container-low transition-colors"
          >
            {mobileOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-outline-variant/15 bg-white/95 backdrop-blur-xl">
          <div className="flex flex-col gap-1 px-4 py-3 max-w-7xl mx-auto">
            <Link
              href="/"
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-3 text-base font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
            >
              {t("explore")}
            </Link>
            <Link
              href="/feed"
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-3 text-base font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
            >
              {t("feed")}
            </Link>
            <Link
              href="/portfolio"
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-3 text-base font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
            >
              {t("portfolio")}
            </Link>
            <Link
              href="/investors"
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-3 text-base font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
            >
              {t("investors")}
            </Link>
            <Link
              href="/grow"
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-3 text-base font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
            >
              $GROW
            </Link>
            {approved ? (
              <Link
                href="/create"
                prefetch={false}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
              >
                {t("create")}
              </Link>
            ) : (
              <Link
                href="/?openInvite=1"
                prefetch={false}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
              >
                {tInvite("requestSubmit")}
              </Link>
            )}
            <div className="mt-2 border-t border-outline-variant/15 pt-3">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
