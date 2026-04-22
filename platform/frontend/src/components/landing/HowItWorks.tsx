"use client";

import { useInView } from "@/lib/landing/useInView";

const STEPS = [
  {
    n: "01",
    title: "Producer launches the campaign",
    body:
      "A Sicilian producer tokenizes next season's harvest as $CAMPAIGN. Sets soft cap, hard cap, funding deadline. All parameters immutable onchain from minute one.",
  },
  {
    n: "02",
    title: "You fund in USDC",
    body:
      "Deposit USDC, receive $CAMPAIGN 1:1 at the listed price. Soft cap missed before the deadline? Burn $CAMPAIGN, get 100% of your USDC back in one transaction. Zero counterparty risk.",
  },
  {
    n: "03",
    title: "Stake, earn $YIELD",
    body:
      "Stake $CAMPAIGN during the harvest season. Accrue $YIELD (the harvest token — $OIL, $CITRUS, whatever the crop is) at 1–5× per day. Rate decays as the vault fills, so earlier stakers earn more.",
  },
  {
    n: "04",
    title: "Redeem: product or USDC",
    body:
      "At harvest, burn $YIELD for physical olive oil — verified on your wallet via Merkle proof — or for your pro-rata share of the USDC pool. 98% to holders, 2% protocol fee.",
  },
  {
    n: "05",
    title: "Next season or exit",
    body:
      "Restake for the next harvest, or unstake with zero penalty once the season ends. Need liquidity early? Queue a sell-back — new buyers fill you first at the current price, FIFO.",
  },
];

export function HowItWorks() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section
      id="how"
      className="glass-section relative w-full py-32 md:py-40"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.5)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
      }}
    >
      <div ref={ref} className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="mb-20 max-w-3xl">
          <span
            className={`reveal ${inView ? "in-view" : ""} mb-6 inline-block text-xs font-bold tracking-[0.18em] uppercase`}
            style={{ color: "#1a1a1a", fontFamily: "var(--font-header)" }}
          >
            How it works
          </span>
          <h2
            className={`reveal reveal-delay-1 ${inView ? "in-view" : ""} font-display text-4xl sm:text-5xl md:text-6xl`}
            style={{ color: "#000000", lineHeight: "1.02" }}
          >
            Five steps. <em>One living cycle.</em>
          </h2>
          <p
            className={`reveal reveal-delay-2 ${inView ? "in-view" : ""} mt-6 max-w-xl text-lg leading-relaxed`}
            style={{ color: "#1a1a1a" }}
          >
            Every campaign is an onchain state machine. Soft cap missed?
            Automatic refund in one block. Harvest fails? Protocol triggers the
            USDC buyback window. No DAO votes, no committees — code is law.
          </p>
        </div>

        <ol className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5 lg:gap-3">
          {STEPS.map((step, i) => (
            <li
              key={step.n}
              className={`reveal reveal-delay-${Math.min(i + 1, 6)} ${inView ? "in-view" : ""} group relative flex flex-col rounded-2xl p-6 transition-all duration-500 hover:-translate-y-1`}
              style={{
                background: "rgba(255,255,255,0.68)",
                border: "1px solid rgba(255,255,255,0.7)",
                backdropFilter: "blur(14px) saturate(1.1)",
                WebkitBackdropFilter: "blur(14px) saturate(1.1)",
                boxShadow:
                  "0 1px 0 0 rgba(255,255,255,0.8) inset, 0 6px 20px -8px rgba(0,0,0,0.08)",
              }}
            >
              <span
                className="font-display inline-flex h-8 w-8 items-center justify-center rounded-full text-xs transition-all duration-300 group-hover:scale-110"
                style={{
                  color: "#ffffff",
                  background:
                    "linear-gradient(135deg, #006b2c 0%, #00873a 100%)",
                  boxShadow: "0 2px 8px -2px rgba(0,135,58,0.4)",
                }}
              >
                {step.n}
              </span>
              <h3
                className="font-display mt-5 text-xl leading-tight transition-transform duration-300 group-hover:translate-x-0.5"
                style={{ color: "#000000" }}
              >
                {step.title}
              </h3>
              <p
                className="mt-3 text-base leading-relaxed"
                style={{ color: "#1a1a1a" }}
              >
                {step.body}
              </p>
              <span
                className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full transition-all duration-500 group-hover:w-full"
                style={{
                  background:
                    "linear-gradient(90deg, #006b2c 0%, #00873a 100%)",
                }}
              />
            </li>
          ))}
        </ol>

        <div className="mt-20 flex flex-col items-start gap-6 border-t border-[#eaeaea] pt-10 md:flex-row md:items-center md:justify-between">
          <p
            className={`reveal ${inView ? "in-view" : ""} max-w-xl text-base leading-relaxed`}
            style={{ color: "#1a1a1a" }}
          >
            Protocol is commodity-agnostic. Olive oil today, citrus, wine,
            honey, coffee tomorrow. Any producer can launch a campaign — no
            permission required, no approval committee.
          </p>
          <a
            href="#campaigns"
            className={`reveal reveal-delay-2 ${inView ? "in-view" : ""} group inline-flex shrink-0 items-center gap-2 rounded-full bg-black px-8 py-3.5 text-sm font-bold text-white transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.4)]`}
            style={{ fontFamily: "var(--font-header)" }}
          >
            See live campaigns
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform duration-300 group-hover:translate-x-1"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
