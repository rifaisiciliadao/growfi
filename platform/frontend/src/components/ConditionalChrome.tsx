"use client";

import { usePathname } from "next/navigation";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { InviteGate } from "./InviteGate";
import { NetworkGuard } from "./NetworkGuard";

export function ConditionalChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const isCampaignDetail = pathname.startsWith("/campaign/");

  if (isLanding) {
    return (
      <>
        <NetworkGuard />
        <main className="flex-grow">{children}</main>
      </>
    );
  }

  return (
    <>
      <Header />
      <NetworkGuard />
      <main className={`flex-grow ${isCampaignDetail ? "pt-0" : "pt-20"}`}>
        <InviteGate>{children}</InviteGate>
      </main>
      <Footer />
    </>
  );
}
