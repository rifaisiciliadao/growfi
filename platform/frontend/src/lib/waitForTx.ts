import { getTransactionReceipt, waitForTransactionReceipt } from "@wagmi/core";
import type { TransactionReceipt } from "viem";
import { config } from "@/app/providers";
import { CHAIN_ID } from "@/contracts";

const WAGMI_CHAIN_ID = CHAIN_ID as never;

export async function waitForTx(
  hash: `0x${string}`,
  opts: {
    minVisibleMs?: number;
    confirmations?: number;
    timeout?: number;
  } = {},
): Promise<TransactionReceipt> {
  const minVisibleMs = opts.minVisibleMs ?? 1200;
  const confirmations = opts.confirmations ?? 1;
  const timeout = opts.timeout ?? 600_000;

  const started = Date.now();
  let receipt: TransactionReceipt;
  try {
    receipt = await waitForTransactionReceipt(config, {
      chainId: WAGMI_CHAIN_ID,
      hash,
      confirmations,
      timeout,
    });
  } catch (err) {
    try {
      receipt = await getTransactionReceipt(config, {
        chainId: WAGMI_CHAIN_ID,
        hash,
      });
    } catch {
      throw err;
    }
  }

  const elapsed = Date.now() - started;
  if (elapsed < minVisibleMs) {
    await new Promise((r) => setTimeout(r, minVisibleMs - elapsed));
  }
  return receipt;
}
