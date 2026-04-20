import { waitForTransactionReceipt } from "@wagmi/core";
import type { TransactionReceipt } from "viem";
import { config } from "@/app/providers";

/**
 * Wait for a transaction receipt with stronger guarantees than the default.
 *
 * Problem this solves: the raw `waitForTransactionReceipt(config, { hash })`
 * sometimes returns quickly enough (or even instantly on re-renders / cached
 * receipts) that the UI flips back to idle before the user can even see the
 * "confirming on-chain" state. That makes people think nothing was signed.
 *
 * Guarantees on top of the raw call:
 *   - `confirmations: 2` — wait for a second block after the one that mined
 *     the tx, so reorgs on Base Sepolia can't make a "success" become "fail"
 *     after we already flipped the UI.
 *   - `timeout: 90_000` — explicit 90s timeout so the UI doesn't hang forever
 *     on a dropped mempool tx; the caller surfaces the error.
 *   - Minimum visible wait (`minVisibleMs`, default 1200ms) — even if the
 *     receipt lands instantly (e.g. cached), the promise doesn't resolve
 *     before this elapses. This keeps the "confirming..." label on screen
 *     long enough for the user to register that something happened, so they
 *     don't perceive the button as "unlocking without waiting".
 */
export async function waitForTx(
  hash: `0x${string}`,
  opts: { minVisibleMs?: number; confirmations?: number } = {},
): Promise<TransactionReceipt> {
  const minVisibleMs = opts.minVisibleMs ?? 1200;
  const confirmations = opts.confirmations ?? 2;

  const started = Date.now();
  const receipt = await waitForTransactionReceipt(config, {
    hash,
    confirmations,
    timeout: 90_000,
  });

  const elapsed = Date.now() - started;
  if (elapsed < minVisibleMs) {
    await new Promise((r) => setTimeout(r, minVisibleMs - elapsed));
  }
  return receipt;
}
