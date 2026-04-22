"use client";

import { useInView } from "@/lib/landing/useInView";

type CampaignState = "funding" | "active" | "ended" | "coming";

type Campaign = {
  name: string;
  producer: string;
  product: string;
  location: string;
  state: CampaignState;
  progress: number;
  progressLabel?: string;
  yieldRate: string;
  yieldLabel: string;
  terms?: string;
  imageUrl?: string;
  hueA: string;
  hueB: string;
  real?: boolean;
};

const CAMPAIGNS: Campaign[] = [
  {
    name: "Sharewood Forest EVOO",
    producer: "Rifai Sicilia DAO",
    product: "Cold-pressed extra-virgin olive oil",
    location: "Sharewood Forest, Sicily",
    state: "funding",
    progress: 9,
    progressLabel: "$1,949 / $22,000 matching",
    yieldRate: "5 L",
    yieldLabel: "Per $1K funded",
    terms:
      "Fund $1,000 → claim 5 L of EVO at harvest, or USDC back if soft cap misses.",
    imageUrl:
      "https://giveth.mypinata.cloud/ipfs/QmTTHwtyQdUTFjVeWCKBosYggjbZzyF3GkjBXWMN6u2YF5",
    hueA: "#2d5a36",
    hueB: "#84a66b",
    real: true,
  },
  {
    name: "Catania Citrus",
    producer: "Producer onboarding",
    product: "Tarocco oranges",
    location: "Catania, Sicily",
    state: "coming",
    progress: 0,
    yieldRate: "—",
    yieldLabel: "Expected yield",
    hueA: "#a8481e",
    hueB: "#f2a14d",
  },
  {
    name: "Etna Vineyard",
    producer: "Producer onboarding",
    product: "Nerello Mascalese",
    location: "Etna Nord, Sicily",
    state: "coming",
    progress: 0,
    yieldRate: "—",
    yieldLabel: "Expected yield",
    hueA: "#3a1c2e",
    hueB: "#8e3a5d",
  },
  {
    name: "Avola Almonds",
    producer: "Producer onboarding",
    product: "Pizzuta almonds",
    location: "Agrigento, Sicily",
    state: "coming",
    progress: 0,
    yieldRate: "—",
    yieldLabel: "Expected yield",
    hueA: "#6b4c2a",
    hueB: "#e8c28a",
  },
  {
    name: "Bronte Hazelnuts",
    producer: "Producer onboarding",
    product: "PDO hazelnuts",
    location: "Bronte, Sicily",
    state: "coming",
    progress: 0,
    yieldRate: "—",
    yieldLabel: "Expected yield",
    hueA: "#3d2a1a",
    hueB: "#a07448",
  },
  {
    name: "Nebrodi Chestnuts",
    producer: "Producer onboarding",
    product: "Mountain chestnuts",
    location: "Nebrodi, Sicily",
    state: "coming",
    progress: 0,
    yieldRate: "—",
    yieldLabel: "Expected yield",
    hueA: "#3a3632",
    hueB: "#8a7a6a",
  },
];

const STATE_LABEL: Record<CampaignState, string> = {
  funding: "Funding",
  active: "Active",
  ended: "Closed",
  coming: "Coming soon",
};

function StateBadge({ state }: { state: CampaignState }) {
  const style =
    state === "funding"
      ? {
          bg: "rgba(255,255,255,0.96)",
          color: "#005320",
          border: "rgba(0,83,32,0.28)",
        }
      : state === "active"
        ? {
            bg: "rgba(0,0,0,0.82)",
            color: "#ffffff",
            border: "rgba(255,255,255,0.22)",
          }
        : state === "coming"
          ? {
              bg: "rgba(255,255,255,0.9)",
              color: "#1f1f1f",
              border: "rgba(0,0,0,0.14)",
            }
          : {
              bg: "rgba(255,255,255,0.88)",
              color: "#4a4a4a",
              border: "rgba(0,0,0,0.12)",
            };

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold tracking-[0.14em] uppercase backdrop-blur-md"
      style={{
        background: style.bg,
        color: style.color,
        borderColor: style.border,
        fontFamily: "var(--font-header)",
      }}
    >
      {state === "active" && (
        <span
          className="animate-subtle-pulse inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: "#7ffc97" }}
        />
      )}
      {state === "funding" && (
        <span className="relative inline-block h-1.5 w-1.5">
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: "#00873a" }}
          />
          <span
            className="animate-live-ring absolute inset-0 rounded-full"
            style={{ background: "#00873a" }}
          />
        </span>
      )}
      {STATE_LABEL[state]}
    </span>
  );
}

export function Campaigns() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section
      id="campaigns"
      className="glass-section relative w-full py-32 md:py-40"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.5)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
      }}
    >
      <div ref={ref} className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="mb-16 flex flex-col items-start justify-between gap-6 md:mb-20 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span
              className={`reveal ${inView ? "in-view" : ""} mb-6 inline-block text-xs font-bold tracking-[0.18em] uppercase`}
              style={{ color: "#1a1a1a", fontFamily: "var(--font-header)" }}
            >
              Campaigns
            </span>
            <h2
              className={`reveal reveal-delay-1 ${inView ? "in-view" : ""} font-display text-4xl sm:text-5xl md:text-6xl`}
              style={{ color: "#000000", lineHeight: "1.02" }}
            >
              One real harvest. <em>Five more to come.</em>
            </h2>
            <p
              className={`reveal reveal-delay-2 ${inView ? "in-view" : ""} mt-6 max-w-xl text-lg leading-relaxed`}
              style={{ color: "#1a1a1a" }}
            >
              Sharewood Forest is live. The other five listings are placeholder
              producers — onboarding in progress. Every new campaign goes
              through the same permissionless factory, no gatekeeping.
            </p>
          </div>

          <div
            className={`reveal reveal-delay-3 ${inView ? "in-view" : ""} flex shrink-0 gap-1 rounded-full border p-1`}
            style={{ borderColor: "#eaeaea", background: "#fafafa" }}
          >
            {["All", "Funding", "Active", "Closed"].map((f, i) => (
              <button
                key={f}
                className="rounded-full px-4 py-2 text-xs tracking-wider uppercase transition-colors"
                style={{
                  background: i === 0 ? "#ffffff" : "transparent",
                  color: i === 0 ? "#000000" : "#4a4a4a",
                  boxShadow: i === 0 ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
                  fontFamily: "var(--font-header)",
                  fontWeight: 700,
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CAMPAIGNS.map((c, i) => {
            const isPlaceholder = c.state === "coming";
            return (
              <article
                key={c.name}
                className={`reveal reveal-delay-${Math.min(i + 1, 6)} ${inView ? "in-view" : ""} group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-500 ${
                  isPlaceholder
                    ? "cursor-not-allowed"
                    : "card-glow hover:-translate-y-2 hover:shadow-[0_24px_56px_-12px_rgba(0,0,0,0.22)]"
                }`}
                style={{
                  border: "1px solid rgba(255,255,255,0.7)",
                  background: "rgba(255,255,255,0.85)",
                  backdropFilter: "blur(14px) saturate(1.1)",
                  WebkitBackdropFilter: "blur(14px) saturate(1.1)",
                  boxShadow:
                    "0 1px 0 0 rgba(255,255,255,0.8) inset, 0 8px 24px -10px rgba(0,0,0,0.1)",
                  opacity: isPlaceholder ? 0.5 : 1,
                }}
              >
                <div
                  className="relative h-56 overflow-hidden"
                  style={{
                    background: c.imageUrl
                      ? "#4052d4"
                      : `linear-gradient(135deg, ${c.hueA} 0%, ${c.hueB} 100%)`,
                  }}
                >
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.imageUrl}
                      alt={c.name}
                      className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.08]"
                      fetchPriority="high"
                      decoding="async"
                    />
                  ) : (
                    <div
                      className="absolute inset-0 animate-slow-pan"
                      style={{
                        backgroundImage:
                          "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.25) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(0,0,0,0.25) 0%, transparent 60%)",
                        mixBlendMode: "overlay",
                      }}
                    />
                  )}

                  {c.imageUrl && (
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.6) 100%)",
                      }}
                    />
                  )}

                  <div className="absolute left-4 top-4">
                    <StateBadge state={c.state} />
                  </div>
                  <div className="absolute bottom-4 right-4 text-right">
                    <span
                      className="font-display text-[10px] tracking-[0.15em] uppercase"
                      style={{ color: "rgba(255,255,255,0.94)" }}
                    >
                      {c.yieldLabel}
                    </span>
                    <div
                      className="font-display text-4xl leading-none"
                      style={{ color: "#ffffff" }}
                    >
                      {c.yieldRate}
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <h3
                    className="font-display text-2xl leading-tight"
                    style={{ color: "#000000" }}
                  >
                    {c.name}
                  </h3>
                  <div
                    className="mt-1 flex items-center gap-2 text-sm"
                    style={{ color: "#4a4a4a" }}
                  >
                    <span>{c.product}</span>
                    <span>·</span>
                    <span>{c.location}</span>
                  </div>

                  {c.terms && (
                    <p
                      className="mt-4 text-base leading-relaxed"
                      style={{ color: "#0f0f0f" }}
                    >
                      {c.terms}
                    </p>
                  )}

                  <div
                    className="mt-6 flex items-center justify-between text-xs font-bold tracking-wider uppercase"
                    style={{
                      color: "#4a4a4a",
                      fontFamily: "var(--font-header)",
                    }}
                  >
                    <span>Progress</span>
                    <span style={{ color: "#000000" }}>
                      {isPlaceholder ? "—" : `${c.progress}%`}
                    </span>
                  </div>
                  <div
                    className="mt-2 h-[3px] w-full overflow-hidden rounded-full"
                    style={{ background: "#f0f0f0" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700 group-hover:brightness-110"
                      style={{
                        width: isPlaceholder ? "0%" : `${c.progress}%`,
                        background:
                          c.state === "ended"
                            ? "#b5b5b5"
                            : "linear-gradient(90deg, #006b2c 0%, #00873a 100%)",
                      }}
                    />
                  </div>
                  {c.progressLabel && !isPlaceholder && (
                    <div
                      className="mt-2 text-xs"
                      style={{
                        color: "#4a4a4a",
                        fontFamily: "var(--font-header)",
                        fontWeight: 700,
                      }}
                    >
                      {c.progressLabel}
                    </div>
                  )}

                  <div
                    className="mt-6 flex items-center justify-between border-t pt-4 text-xs"
                    style={{ borderColor: "#eaeaea", color: "#4a4a4a" }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-header)",
                        fontWeight: 700,
                      }}
                    >
                      {c.producer}
                    </span>
                    {isPlaceholder ? (
                      <span style={{ color: "#4a4a4a" }}>—</span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 transition-transform duration-300 group-hover:translate-x-1"
                        style={{
                          color: "#000000",
                          fontFamily: "var(--font-header)",
                          fontWeight: 700,
                        }}
                      >
                        {c.real ? "Fund this harvest" : "View"}
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12h14M13 5l7 7-7 7" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
