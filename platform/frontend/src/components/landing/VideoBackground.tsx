"use client";

import { useEffect, useRef, useState } from "react";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_083109_283f3553-e28f-428b-a723-d639c617eb2b.mp4";

const FADE = 0.5;

export function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tick = () => {
      const v = videoRef.current;
      if (!v) return;
      const d = v.duration;
      const t = v.currentTime;
      if (Number.isFinite(d) && d > 0) {
        let o = 1;
        if (t < FADE) {
          o = t / FADE;
        } else if (t > d - FADE) {
          o = Math.max(0, (d - t) / FADE);
        }
        setOpacity(o);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const handleEnded = async () => {
      setOpacity(0);
      await new Promise((r) => setTimeout(r, 100));
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = 0;
      try {
        await v.play();
      } catch {
        /* autoplay blocked */
      }
    };

    video.addEventListener("ended", handleEnded);
    rafRef.current = requestAnimationFrame(tick);
    video.play().catch(() => {});

    return () => {
      video.removeEventListener("ended", handleEnded);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: -10 }}
    >
      <video
        ref={videoRef}
        src={VIDEO_URL}
        muted
        playsInline
        autoPlay
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity, transition: "opacity 120ms linear" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.04) 60%, rgba(0,0,0,0.18) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(0,107,44,0.06) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0) 60%, rgba(127,252,151,0.05) 100%)",
        }}
      />
    </div>
  );
}
