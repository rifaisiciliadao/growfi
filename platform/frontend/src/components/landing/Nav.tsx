"use client";

import { LandingLogo } from "./LandingLogo";

const MENU = [
  { label: "Home", href: "#home", active: true },
  { label: "How it works", href: "#how" },
  { label: "Campaigns", href: "#campaigns" },
  { label: "Trust", href: "#trust" },
  { label: "Manifesto", href: "#manifesto" },
];

export function Nav() {
  return (
    <nav className="relative z-10 w-full">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 md:px-8">
        <a
          href="#home"
          className="shrink-0 transition-transform duration-200 hover:scale-[1.02]"
        >
          <LandingLogo />
        </a>
        <div className="hidden items-center gap-8 md:flex">
          {MENU.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="relative text-sm font-bold tracking-wide transition-colors"
              style={{
                color: item.active ? "#000000" : "#4a4a4a",
                fontFamily: "var(--font-header)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#000000")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = item.active ? "#000000" : "#4a4a4a")
              }
            >
              {item.label}
            </a>
          ))}
        </div>
        <a
          href="#campaigns"
          className="inline-flex items-center rounded-full bg-black px-6 py-2.5 text-sm font-bold text-white shadow-[0_4px_16px_-4px_rgba(0,0,0,0.25)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.4)]"
          style={{ fontFamily: "var(--font-header)" }}
        >
          Fund the Harvest
        </a>
      </div>
    </nav>
  );
}
