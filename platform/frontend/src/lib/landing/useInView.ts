"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_OPTIONS: IntersectionObserverInit = {
  threshold: 0.08,
  rootMargin: "0px 0px -5% 0px",
};

export function useInView<T extends HTMLElement>(
  options: IntersectionObserverInit = DEFAULT_OPTIONS,
) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const revealNextFrame = () => {
      const frame = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(frame);
    };

    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < vh * 0.95) {
      return revealNextFrame();
    }

    if (typeof IntersectionObserver === "undefined") {
      return revealNextFrame();
    }

    const obs = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.isIntersecting) {
        setInView(true);
        obs.unobserve(entry.target);
      }
    }, options);
    obs.observe(el);

    const t = window.setTimeout(() => setInView(true), 2000);

    return () => {
      obs.disconnect();
      window.clearTimeout(t);
    };
  }, [options]);

  return { ref, inView };
}
