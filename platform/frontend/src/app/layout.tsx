import type { Metadata } from "next";
import {
  Inter,
  Be_Vietnam_Pro,
  Crimson_Text,
  Plus_Jakarta_Sans,
} from "next/font/google";
import { Providers } from "./providers";
import { ConditionalChrome } from "@/components/ConditionalChrome";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const crimsonText = Crimson_Text({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-crimson-text",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://growfi-test-m9s8u.ondigitalocean.app";

const SITE_TITLE = "GrowFi — Regenerative Finance for a Living Planet";
const SITE_DESCRIPTION =
  "Fund real harvests onchain. Invest in olives, harvest oil — or get your USDC back, locked in smart-contract escrow until the soft cap is met.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · GrowFi",
  },
  description: SITE_DESCRIPTION,
  applicationName: "GrowFi",
  authors: [{ name: "Rifai Sicilia DAO", url: "https://www.rifaisicilia.com/" }],
  keywords: [
    "RegenFi",
    "regenerative finance",
    "tokenized harvests",
    "permissionless",
    "Base",
    "onchain agriculture",
    "DeFi",
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "GrowFi",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    creator: "@RifaiSicilia",
    site: "@RifaiSicilia",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${inter.variable} ${beVietnamPro.variable} ${plusJakarta.variable} ${crimsonText.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-surface text-on-surface">
        <Providers>
          <ConditionalChrome>{children}</ConditionalChrome>
        </Providers>
      </body>
    </html>
  );
}
