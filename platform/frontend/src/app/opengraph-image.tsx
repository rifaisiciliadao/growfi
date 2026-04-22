import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "GrowFi — Regenerative Finance for a Living Planet";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadGoogleFont(family: string, weight: number, italic = false) {
  const axis = italic ? "ital,wght@1," : "wght@";
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    family,
  )}:${axis}${weight}&display=swap`;
  const css = await (
    await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      },
    })
  ).text();
  const m = css.match(/src:\s*url\(([^)]+?)\)\s*format/);
  if (!m) throw new Error(`font url not parsed for ${family}`);
  const res = await fetch(m[1]);
  if (!res.ok) throw new Error(`font fetch ${res.status} for ${family}`);
  return res.arrayBuffer();
}

async function tryLoadFonts() {
  try {
    const [beVietnam, crimsonItalic] = await Promise.all([
      loadGoogleFont("Be Vietnam Pro", 700),
      loadGoogleFont("Crimson Text", 400, true),
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
