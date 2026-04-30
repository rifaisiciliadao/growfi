"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isGatedPath, useInviteGate } from "@/lib/inviteGate";
import { Spinner } from "./Spinner";

export function InviteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useInviteGate();

  const gated = isGatedPath(pathname);

  useEffect(() => {
    if (!gated) return;
    if (state === "no-wallet") {
      router.replace("/?gated=1&reason=connect");
      return;
    }
    if (state === "none") {
      router.replace("/?gated=1&reason=request");
      return;
    }
    if (state === "pending") {
      router.replace("/?gated=1&reason=pending");
      return;
    }
    if (state === "rejected") {
      router.replace("/?gated=1&reason=rejected");
      return;
    }
  }, [gated, state, router]);

  if (gated && state !== "approved") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return <>{children}</>;
}
