"use client";

import { useEffect, useRef, useState } from "react";

type Options = {
  to: number;
  duration?: number;
  active?: boolean;
  decimals?: number;
};

export function useCountUp({
  to,
  duration = 1400,
  active = true,
  decimals = 0,
}: Options) {
  const [value, setValue] = useState(0);
  const startTs = useRef<number | null>(null);
  const startValue = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setValue(to);
      return;
    }

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    startTs.current = null;
    setValue((prev) => {
      startValue.current = prev;
      return prev;
    });

    const tick = (ts: number) => {
      if (startTs.current === null) startTs.current = ts;
      const elapsed = ts - startTs.current;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(startValue.current + (to - startValue.current) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, to, duration]);

  const formatted =
    decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();

  return { value, formatted };
}
