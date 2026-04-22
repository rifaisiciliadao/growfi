import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const alt = "GrowFi — Regenerative Finance for a Living Planet";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Fonts are shipped as TTFs under public/fonts/. Google Fonts CSS fetching
// at build time returned WOFF2 (which satori can't parse), so the OG route
// keeps the assets local and reads them from the filesystem at prerender.
async function tryLoadFonts() {
  try {
    const fontDir = path.join(process.cwd(), "public", "fonts");
    const [beVietnam, crimsonItalic] = await Promise.all([
      readFile(path.join(fontDir, "BeVietnamPro-Bold.ttf")),
      readFile(path.join(fontDir, "CrimsonText-Italic.ttf")),
    ]);
    return { beVietnam, crimsonItalic };
  } catch (err) {
    console.error("[opengraph-image] font load failed:", err);
    return null;
  }
}

export default async function Image() {
  const fonts = await tryLoadFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 80px",
          background:
            "linear-gradient(135deg, #062b15 0%, #0d3a1e 45%, #1a5c2f 100%)",
          color: "#ffffff",
          fontFamily: "'Be Vietnam Pro'",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg
            width="64"
            height="64"
            viewBox="0 0 88 88"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="44"
              cy="44"
              r="42"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3"
            />
            <path
              d="M 26 56 Q 26 32 44 26 Q 44 50 26 56 Z"
              fill="#7ffc97"
            />
            <path
              d="M 62 32 Q 62 56 44 62 Q 44 38 62 32 Z"
              fill="#00873a"
            />
          </svg>
          <span
            style={{
              fontSize: 52,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: "#ffffff",
            }}
          >
            GrowFi
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: 20,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "#7ffc97",
              fontWeight: 700,
            }}
          >
            Syntropic agroforestry · onchain
          </span>

          <div
            style={{
              marginTop: 24,
              display: "flex",
              flexWrap: "wrap",
              columnGap: 20,
              fontSize: 86,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1,
              color: "#ffffff",
            }}
          >
            <span>Fund real</span>
            <span
              style={{
                fontFamily: "'Crimson Text'",
                fontStyle: "italic",
                fontWeight: 400,
                color: "#7ffc97",
                letterSpacing: "-0.02em",
              }}
            >
              harvests
            </span>
            <span>onchain.</span>
          </div>

          <span
            style={{
              marginTop: 32,
              fontSize: 34,
              fontWeight: 700,
              color: "rgba(255,255,255,0.92)",
              letterSpacing: "-0.01em",
            }}
          >
            Invest in olives, harvest oil.
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 18,
            color: "rgba(255,255,255,0.68)",
            letterSpacing: "0.02em",
          }}
        >
          <span>Permissionless campaign factory · Base</span>
          <span>growfi · rifaisicilia.com</span>
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
