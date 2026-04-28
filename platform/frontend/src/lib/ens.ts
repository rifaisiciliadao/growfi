"use client";

import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http, type Address } from "viem";
import { mainnet } from "viem/chains";

/**
 * ENS reverse-lookup utilities. Lives outside the wagmi config because:
 *   1. Our app config only knows about Base + Base Sepolia (the contracts'
 *      home). ENS is on Ethereum mainnet — completely separate RPC.
 *   2. ENS reads are public — no signer / wallet needed — so a standalone
 *      viem publicClient is the right shape.
 *
 * `viem.getEnsName` already does the canonical reverse lookup AND forward
 * verification (resolves the address, then checks the name's resolver
 * actually maps back to the same address). Spoofing-safe.
 *
 * Public RPC fallback chain — first one wins, rest are passive backups for
 * the rare case of a 5xx during a page load. None of these need an API
 * key. If you find them rate-limited under demo load, swap in an Alchemy
 * key via NEXT_PUBLIC_MAINNET_RPC_URL.
 */
const MAINNET_RPCS = [
  process.env.NEXT_PUBLIC_MAINNET_RPC_URL,
  "https://eth.llamarpc.com",
  "https://cloudflare-eth.com",
  "https://rpc.ankr.com/eth",
].filter((u): u is string => !!u);

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(MAINNET_RPCS[0], {
    retryCount: 2,
    retryDelay: 400,
    timeout: 8_000,
  }),
});

/**
 * Reverse-lookup a single address → ENS name (or null). Cached 1h via
 * React Query — ENS rarely flips and the failure case ("no ENS") is the
 * far more common one we'd rather not re-query.
 */
export function useEnsName(address: Address | string | undefined) {
  const lc = address?.toLowerCase();
  return useQuery({
    queryKey: ["ens", "name", lc],
    enabled: !!lc && /^0x[a-f0-9]{40}$/.test(lc),
    staleTime: 60 * 60 * 1000, // 1h
    gcTime: 24 * 60 * 60 * 1000, // 24h
    queryFn: async () => {
      if (!lc) return null;
      try {
        return await mainnetClient.getEnsName({ address: lc as Address });
      } catch {
        return null;
      }
    },
  });
}

/**
 * Batch variant — runs reverse-lookups in parallel and returns an
 * `address → name | null` map. Use this when rendering an InvestorList
 * to keep the call count tied to the row count rather than re-querying
 * via `useEnsName` per row. Each cache entry is keyed individually so a
 * subsequent mount with a subset of the same addresses re-uses cached
 * names instead of re-fetching.
 */
export function useBatchEnsNames(
  addresses: Array<Address | string> | undefined,
) {
  const keys = (addresses ?? [])
    .filter((a): a is string => !!a && /^0x[a-fA-F0-9]{40}$/.test(a))
    .map((a) => a.toLowerCase())
    .sort();
  const cacheKey = keys.join(",");
  return useQuery({
    queryKey: ["ens", "names-batch", cacheKey],
    enabled: keys.length > 0,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<Map<string, string | null>> => {
      const entries = await Promise.all(
        keys.map(async (lc) => {
          try {
            const name = await mainnetClient.getEnsName({
              address: lc as Address,
            });
            return [lc, name] as const;
          } catch {
            return [lc, null] as const;
          }
        }),
      );
      return new Map(entries);
    },
  });
}
