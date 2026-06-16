import { baseSepolia, base, sepolia, mainnet } from "wagmi/chains";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? mainnet.id);

const EXPLORERS: Record<number, string> = {
  [baseSepolia.id]: "https://sepolia.basescan.org",
  [base.id]: "https://basescan.org",
  [sepolia.id]: "https://sepolia.etherscan.io",
  [mainnet.id]: "https://etherscan.io",
};

const EXPLORER_NAMES: Record<number, string> = {
  [baseSepolia.id]: "BaseScan",
  [base.id]: "BaseScan",
  [sepolia.id]: "Etherscan",
  [mainnet.id]: "Etherscan",
};

export function explorerBase(chainId: number = CHAIN_ID): string {
  return EXPLORERS[chainId] ?? EXPLORERS[mainnet.id];
}

export function explorerName(chainId: number = CHAIN_ID): string {
  return EXPLORER_NAMES[chainId] ?? EXPLORER_NAMES[mainnet.id];
}

export function txUrl(hash: string, chainId: number = CHAIN_ID): string {
  return `${explorerBase(chainId)}/tx/${hash}`;
}

export function addressUrl(address: string, chainId: number = CHAIN_ID): string {
  return `${explorerBase(chainId)}/address/${address}`;
}
