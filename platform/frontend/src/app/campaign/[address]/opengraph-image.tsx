import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  campaignProgressPercent,
  campaignPreviewDescription,
  campaignPreviewTitle,
  campaignTargetUsd,
  formatUsd18,
  getCampaignPreview,
  shortAddress,
  truncateText,
} from "@/lib/campaignPreview";

export const alt = "GrowFi campaign";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300;

type ImageProps = {
  params: Promise<{ address: string }> | { address: string };
};

async function tryLoadFonts() {
  try {
    const fontDir = path.join(process.cwd(), "public", "fonts");
    const [beVietnam, crimsonItalic] = await Promise.all([
      readFile(path.join(fontDir, "BeVietnamPro-Bold.ttf")),
      readFile(path.join(fontDir, "CrimsonText-Italic.ttf")),
    ]);
    return { beVietnam, crimsonItalic };
  } catch (err) {
    console.error("[campaign-opengraph-image] font load failed:", err);
    return null;
  }
}

function productLabel(value: string): string {
  if (!value) return "Real asset";
  const head = value.split(":")[0] || value;
  return head
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function stateLabel(value: string | undefined): string {
  if (value === "Active") return "Active campaign";
  if (value === "Buyback") return "Buyback open";
  if (value === "Ended") return "Closed campaign";
  return "Funding campaign";
}

export default async function Image({ params }: ImageProps) {
  const { address } = await Promise.resolve(params);
  const [fonts, preview] = await Promise.all([
    tryLoadFonts(),
    getCampaignPreview(address),
  ]);

  const title = campaignPreviewTitle(preview, address);
  const description = truncateText(campaignPreviewDescription(preview), 150);
  const target = campaignTargetUsd(preview);
  const targetLabel = target > 0n ? formatUsd18(target) : "Live onchain";
  const progressLabel = campaignProgressPercent(preview);
  const firstHarvest = preview?.firstHarvestYear && preview.firstHarvestYear !== "0"
    ? preview.firstHarvestYear
    : "Tracked";
  const location = preview?.location || "GrowFi campaign";
  const product = productLabel(preview?.productType || "");
  const image = preview?.image;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 52,
          background: "#f5f8f1",
          color: "#111814",
          fontFamily: "'Be Vietnam Pro'",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(120deg, rgba(245,248,241,1) 0%, rgba(245,248,241,0.92) 48%, rgba(211,226,209,0.72) 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            width: "100%",
            height: "100%",
            gap: 40,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: 610,
              padding: "22px 0",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <svg
                  width="54"
                  height="54"
                  viewBox="0 0 88 88"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="44"
                    cy="44"
                    r="41"
                    fill="#ffffff"
                    stroke="#1d2a23"
                    strokeWidth="3"
                  />
                  <path
                    d="M 26 56 Q 26 32 44 26 Q 44 50 26 56 Z"
                    fill="#00873a"
                  />
                  <path
                    d="M 62 32 Q 62 56 44 62 Q 44 38 62 32 Z"
                    fill="#36c66c"
                  />
                </svg>
                <div
                  style={{
                    display: "flex",
                    fontSize: 34,
                    fontWeight: 700,
                    letterSpacing: "-0.04em",
                  }}
                >
                  GrowFi
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginTop: 48,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    borderRadius: 999,
                    padding: "8px 13px",
                    background: "#ffffff",
                    border: "1px solid rgba(22,42,31,0.16)",
                    color: "#00662b",
                    fontSize: 16,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 999,
                      background: "#36c66c",
                    }}
                  />
                  {stateLabel(preview?.state)}
                </div>
                <div
                  style={{
                    display: "flex",
                    borderRadius: 999,
                    padding: "8px 13px",
                    background: "rgba(255,255,255,0.74)",
                    border: "1px solid rgba(22,42,31,0.12)",
                    color: "#415149",
                    fontSize: 16,
                  }}
                >
                  {shortAddress(address)}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginTop: 24,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 72,
                    lineHeight: 0.96,
                    letterSpacing: "-0.065em",
                    color: "#0f1713",
                    maxWidth: 610,
                  }}
                >
                  {title}
                </div>
                <div
                  style={{
                    display: "flex",
                    marginTop: 24,
                    fontSize: 25,
                    lineHeight: 1.35,
                    color: "#415149",
                    maxWidth: 570,
                  }}
                >
                  {description}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                color: "#415149",
                fontSize: 18,
              }}
            >
              <span>{product}</span>
              <span>·</span>
              <span>{location}</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 442,
              height: "100%",
              borderRadius: 28,
              overflow: "hidden",
              background: "#111814",
              border: "1px solid rgba(22,42,31,0.16)",
              boxShadow: "0 30px 80px rgba(17,24,20,0.16)",
            }}
          >
            <div
              style={{
                position: "relative",
                display: "flex",
                height: 330,
                background:
                  "linear-gradient(135deg, #1f4f2b 0%, #86a46e 100%)",
              }}
            >
              {image ? (
                <img
                  src={image}
                  alt=""
                  width="442"
                  height="330"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    background:
                      "radial-gradient(circle at 34% 24%, rgba(255,255,255,0.26) 0%, transparent 44%)",
                  }}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.46) 100%)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 26,
                  bottom: 24,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  color: "#ffffff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 17,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    opacity: 0.82,
                  }}
                >
                  Campaign target
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 48,
                    lineHeight: 1,
                    letterSpacing: "-0.045em",
                  }}
                >
                  {targetLabel}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                padding: 26,
                background: "#0e1812",
                color: "#ffffff",
                flex: 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 14,
                }}
              >
                <Metric label="Progress" value={progressLabel} />
                <Metric label="First harvest" value={firstHarvest} />
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: "auto",
                  borderTop: "1px solid rgba(255,255,255,0.12)",
                  paddingTop: 18,
                  color: "rgba(255,255,255,0.72)",
                  fontSize: 17,
                }}
              >
                Transparent campaign funding on Ethereum.
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fonts
        ? [
            {
              name: "Be Vietnam Pro",
              data: fonts.beVietnam,
              style: "normal",
              weight: 700,
            },
            {
              name: "Crimson Text",
              data: fonts.crimsonItalic,
              style: "italic",
              weight: 400,
            },
          ]
        : undefined,
    },
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        borderRadius: 18,
        padding: "16px 18px",
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 14,
          color: "rgba(255,255,255,0.58)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 8,
          fontSize: 28,
          lineHeight: 1,
          letterSpacing: "-0.04em",
          color: "#ffffff",
        }}
      >
        {value}
      </div>
    </div>
  );
}
