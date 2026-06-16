import { base, baseSepolia, foundry, mainnet, sepolia } from "wagmi/chains";

export const EXPECTED_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 1);

const KNOWN_CHAINS = [foundry, sepolia, mainnet, baseSepolia, base] as const;

export const EXPECTED_CHAIN =
  KNOWN_CHAINS.find((chain) => chain.id === EXPECTED_CHAIN_ID) ?? baseSepolia;

export function chainName(chainId: number | undefined): string {
  if (!chainId) return "Unknown network";
  return KNOWN_CHAINS.find((chain) => chain.id === chainId)?.name ?? `Chain ${chainId}`;
}
