import { Suspense } from "react";
import { LandingBackdrop } from "@/components/landing/LandingBackdrop";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Trust } from "@/components/landing/Trust";
import { Partners } from "@/components/landing/Partners";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { InviteModal } from "@/components/landing/InviteModal";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="landing-root relative min-h-screen w-full">
      <LandingBackdrop />
      <div className="relative z-0">
        <Hero />
        <HowItWorks />
        <Trust />
        <Partners />
        <LandingFooter />
      </div>
      <Suspense fallback={null}>
        <InviteModal />
      </Suspense>
    </div>
  );
}
