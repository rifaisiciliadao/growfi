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
    "text-sm font-semibold tracking-[-0.01em] text-on-surface-variant hover:text-on-surface transition-colors";
  const menuLinkClass =
    "app-control flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface";
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
          "app-control h-10 px-3 md:px-4 rounded-full text-xs md:text-sm font-semibold bg-white/88 border border-outline-variant/35 text-on-surface hover:bg-white hover:shadow-[0_14px_34px_-26px_rgba(14,35,17,0.55)] flex items-center gap-2 whitespace-nowrap";

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
    <nav className="fixed top-0 z-50 w-full bg-transparent px-3 py-3 md:px-5">
      <div className="app-card relative flex h-16 w-full max-w-7xl items-center justify-between gap-2 rounded-full px-3 md:gap-6 md:px-5 mx-auto backdrop-blur-xl">
        <Link href="/" prefetch={false} className="relative z-10 flex items-center gap-1 shrink-0 min-w-0">
          <Logo />
        </Link>

        <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-5 lg:flex">
          <Link href="/campaigns" prefetch={false} className={linkClass}>
            {t("campaigns")}
          </Link>
          <Link href="/investors" prefetch={false} className={linkClass}>
            {t("investors")}
          </Link>
          <Link href="/grow" prefetch={false} className={linkClass}>
            $GROW
          </Link>
          <Link href="/faq" prefetch={false} className={linkClass}>
            {t("faq")}
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
              className="app-control flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/35 bg-white/88 text-on-surface hover:bg-white hover:shadow-[0_14px_34px_-26px_rgba(14,35,17,0.55)]"
            >
              <MenuGlyph open={desktopOpen} />
            </button>
            {desktopOpen && (
              <div
                role="menu"
                className="app-card absolute right-0 top-full mt-3 w-60 rounded-2xl p-1.5 backdrop-blur-xl"
              >
                <Link
                  href="/campaigns"
                  prefetch={false}
                  role="menuitem"
                  onClick={() => setDesktopOpen(false)}
                  className={`${menuLinkClass} lg:hidden`}
                >
                  {t("campaigns")}
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
                  href="/faq"
                  prefetch={false}
                  role="menuitem"
                  onClick={() => setDesktopOpen(false)}
                  className={menuLinkClass}
                >
                  {t("faq")}
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
            className="app-control md:hidden flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/35 bg-white/88 text-on-surface hover:bg-white"
          >
            <MenuGlyph open={mobileOpen} />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="app-card mt-2 md:hidden rounded-3xl backdrop-blur-xl">
          <div className="flex flex-col gap-1 px-3 py-3 max-w-7xl mx-auto">
            <Link
              href="/campaigns"
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              className="app-control rounded-2xl px-3 py-3 text-base font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
            >
              {t("campaigns")}
            </Link>
            <Link
              href="/feed"
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              className="app-control rounded-2xl px-3 py-3 text-base font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
            >
              {t("feed")}
            </Link>
            <Link
              href="/faq"
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              className="app-control rounded-2xl px-3 py-3 text-base font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
            >
              {t("faq")}
            </Link>
            <Link
              href="/portfolio"
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              className="app-control rounded-2xl px-3 py-3 text-base font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
            >
              {t("portfolio")}
            </Link>
            <Link
              href="/investors"
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              className="app-control rounded-2xl px-3 py-3 text-base font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
            >
              {t("investors")}
            </Link>
            <Link
              href="/grow"
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              className="app-control rounded-2xl px-3 py-3 text-base font-semibold text-primary hover:bg-primary-fixed/45"
            >
              $GROW
            </Link>
            {approved ? (
              <Link
                href="/create"
                prefetch={false}
                onClick={() => setMobileOpen(false)}
                className="app-control rounded-2xl px-3 py-3 text-base font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              >
                {t("create")}
              </Link>
            ) : (
              <Link
                href="/?openInvite=1"
                prefetch={false}
                onClick={() => setMobileOpen(false)}
                className="app-control rounded-2xl px-3 py-3 text-base font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
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

function MenuGlyph({ open }: { open: boolean }) {
  return (
    <span className="relative block h-4 w-4" aria-hidden>
      <span
        className={`absolute left-0 top-[3px] h-[1.5px] w-4 rounded-full bg-current transition-transform duration-300 ${
          open ? "translate-y-[5px] rotate-45" : ""
        }`}
      />
      <span
        className={`absolute left-0 top-[8px] h-[1.5px] w-4 rounded-full bg-current transition-opacity duration-200 ${
          open ? "opacity-0" : "opacity-100"
        }`}
      />
      <span
        className={`absolute left-0 top-[13px] h-[1.5px] w-4 rounded-full bg-current transition-transform duration-300 ${
          open ? "-translate-y-[5px] -rotate-45" : ""
        }`}
      />
    </span>
  );
}
