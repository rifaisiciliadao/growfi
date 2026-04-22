"use client";

import { LandingLogo } from "./LandingLogo";
import { useInView } from "@/lib/landing/useInView";

const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#how" },
      { label: "Campaigns", href: "#campaigns" },
      { label: "For producers", href: "#" },
      { label: "Portfolio", href: "#" },
    ],
  },
  {
    title: "Protocol",
    links: [
      { label: "Documentation", href: "#" },
      { label: "Smart contracts", href: "#" },
      { label: "Subgraph", href: "#" },
      { label: "Audit", href: "#" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "GitHub", href: "https://github.com/rifaisiciliadao/growfi" },
      { label: "Discord", href: "#" },
      { label: "Twitter", href: "#" },
      { label: "Newsletter", href: "#" },
    ],
  },
];

export function LandingFooter() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <footer
      className="glass-section relative w-full"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.5)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
      }}
    >
      <div ref={ref} className="mx-auto max-w-7xl px-6 py-20 md:px-8">
        <div className="grid grid-cols-1 gap-16 md:grid-cols-12">
          <div className={`reveal ${inView ? "in-view" : ""} md:col-span-5`}>
            <LandingLogo />
            <p
              className="font-display mt-6 max-w-sm text-2xl leading-snug"
              style={{ color: "#000000" }}
            >
              Regenerative finance <em>for a living planet.</em>
            </p>
            <p
              className="mt-6 max-w-sm text-base leading-relaxed"
              style={{ color: "#1a1a1a" }}
            >
              GrowFi is built by Rifai Sicilia DAO. Commodity-agnostic,
              chain-agnostic, permissionless. Any producer, any harvest, any
              chain — no approval required.
            </p>
          </div>

          <div className="md:col-span-7 grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLS.map((col, ci) => (
              <div
                key={col.title}
                className={`reveal reveal-delay-${ci + 1} ${inView ? "in-view" : ""}`}
              >
                <h4
                  className="mb-5 text-xs font-bold tracking-[0.18em] uppercase"
                  style={{ color: "#000000", fontFamily: "var(--font-header)" }}
                >
                  {col.title}
                </h4>
                <ul className="flex flex-col gap-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-base transition-colors"
                        style={{ color: "#4a4a4a" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "#000000")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "#4a4a4a")
                        }
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div
          className="mt-16 flex flex-col items-start justify-between gap-4 border-t pt-8 md:flex-row md:items-center"
          style={{ borderColor: "#eaeaea" }}
        >
          <p className="text-xs" style={{ color: "#4a4a4a" }}>
            © {new Date().getFullYear()} Rifai Sicilia DAO. All code
            open-source under MIT license.
          </p>
          <div className="flex gap-6 text-xs" style={{ color: "#4a4a4a" }}>
            <a href="#" className="transition-colors hover:text-black">
              Terms
            </a>
            <a href="#" className="transition-colors hover:text-black">
              Privacy
            </a>
            <a href="#" className="transition-colors hover:text-black">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
