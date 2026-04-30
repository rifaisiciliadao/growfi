import { Suspense } from "react";
import { VideoBackground } from "@/components/landing/VideoBackground";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Campaigns } from "@/components/landing/Campaigns";
import { Trust } from "@/components/landing/Trust";
import { Partners } from "@/components/landing/Partners";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { InviteSection } from "@/components/landing/InviteSection";

export default function Home() {
  return (
    <div className="landing-root relative min-h-screen w-full">
      <VideoBackground />
      <div className="relative z-0">
        <Hero />
        <Suspense fallback={<div className="min-h-[400px]" />}>
          <InviteSection />
        </Suspense>
        <Campaigns />
        <HowItWorks />
        <Trust />
        <Partners />
        <LandingFooter />
      </div>
    </div>
  );
}
