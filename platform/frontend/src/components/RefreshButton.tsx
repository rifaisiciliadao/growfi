"use client";

import { useState } from "react";
import { Spinner } from "./Spinner";

/**
 * Pill button that triggers a manual refresh of the subgraph-backed data
 * on the current page. Pass the React Query refetch callback (or several
 * wrapped in an async fn) — we'll show a spinner until the promise resolves
 * so the user knows the request is in flight.
 */
export function RefreshButton({
  onClick,
  label = "Refresh",
  className = "",
}: {
  onClick: () => Promise<unknown> | void;
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onClick();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      className={`inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-3 py-1.5 text-xs font-medium text-on-surface-variant transition hover:border-primary/40 hover:text-primary disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {busy ? (
        <Spinner size={12} />
      ) : (
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M16 4v5h-5M4 16v-5h5M4.5 9a6 6 0 0110.8-1.3M15.5 11a6 6 0 01-10.8 1.3"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <span>{label}</span>
    </button>
  );
}
