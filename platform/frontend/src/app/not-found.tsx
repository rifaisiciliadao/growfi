"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-20 text-center">
      <div className="relative mx-auto w-64 h-64 md:w-72 md:h-72 mb-8">
        <svg
          viewBox="0 0 280 280"
          className="w-full h-full"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="nf-sky" cx="50%" cy="30%" r="80%">
              <stop offset="0%" stopColor="#fef9e8" />
              <stop offset="100%" stopColor="#f0f7ee" />
            </radialGradient>
            <linearGradient id="nf-soil" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#7d5a3a" />
              <stop offset="100%" stopColor="#4a3522" />
            </linearGradient>
          </defs>

          <circle cx="140" cy="120" r="120" fill="url(#nf-sky)" />

          <ellipse cx="140" cy="232" rx="110" ry="10" fill="#000" opacity="0.06" />

          <path
            d="M 30 220 Q 80 180 140 195 T 250 220 L 250 270 L 30 270 Z"
            fill="url(#nf-soil)"
          />

          <ellipse
            cx="140"
            cy="200"
            rx="22"
            ry="10"
            fill="#2a1d12"
            opacity="0.85"
          />

          <g className="nf-seed">
            <ellipse cx="140" cy="115" rx="9" ry="13" fill="#a87349" />
            <path
              d="M 132 110 Q 140 95 148 110"
              fill="none"
              stroke="#5a3a1f"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>

          <g opacity="0.75">
            <text
              x="80"
              y="80"
              fontSize="16"
              fontFamily="ui-monospace, monospace"
              fill="#9aa89a"
            >
              4
            </text>
            <text
              x="135"
              y="70"
              fontSize="22"
              fontFamily="ui-monospace, monospace"
              fill="#7a8a7a"
            >
              0
            </text>
            <text
              x="195"
              y="85"
              fontSize="14"
              fontFamily="ui-monospace, monospace"
              fill="#9aa89a"
            >
              4
            </text>
          </g>

          <g className="nf-bug" transform="translate(180 150)">
            <circle r="4" fill="#1a2e1f" />
            <path
              d="M -8 -4 Q -4 -10 0 -4"
              fill="none"
              stroke="#1a2e1f"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M 8 -4 Q 4 -10 0 -4"
              fill="none"
              stroke="#1a2e1f"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </g>
        </svg>

        <style jsx>{`
          .nf-seed {
            transform-origin: 140px 200px;
            animation: nf-bounce 2.6s ease-in-out infinite;
          }
          .nf-bug {
            animation: nf-flutter 5.5s ease-in-out infinite;
          }
          @keyframes nf-bounce {
            0%,
            100% {
              transform: translateY(-2px) rotate(-3deg);
            }
            45% {
              transform: translateY(60px) rotate(2deg);
            }
            50% {
              transform: translateY(58px) rotate(2deg);
            }
            55% {
              transform: translateY(60px) rotate(-2deg);
            }
          }
          @keyframes nf-flutter {
            0%,
            100% {
              transform: translate(180px, 150px) rotate(-2deg);
            }
            25% {
              transform: translate(60px, 110px) rotate(8deg);
            }
            50% {
              transform: translate(210px, 90px) rotate(-6deg);
            }
            75% {
              transform: translate(95px, 165px) rotate(4deg);
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .nf-seed,
            .nf-bug {
              animation: none;
            }
          }
        `}</style>
      </div>

      <p className="text-xs font-mono uppercase tracking-[0.18em] text-on-surface-variant mb-3">
        404
      </p>
      <h1 className="text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-4">
        {t("title")}
      </h1>
      <p className="text-base md:text-lg text-on-surface-variant max-w-md mx-auto leading-relaxed mb-2">
        {t("body")}
      </p>
      <p className="text-sm text-on-surface-variant/80 italic mb-10">
        {t("aside")}
      </p>

      <div className="flex items-center justify-center gap-3 flex-wrap">
        <Link
          href="/"
          className="bg-primary text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition"
        >
          {t("ctaHome")}
        </Link>
        <Link
          href="/#campaigns"
          className="px-6 py-2.5 rounded-full text-sm font-semibold text-on-surface border border-outline-variant/30 hover:bg-surface-container-low transition"
        >
          {t("ctaExplore")}
        </Link>
      </div>
    </div>
  );
}
