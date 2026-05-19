"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { EXPECTED_CHAIN, EXPECTED_CHAIN_ID, chainName } from "./chains";

export function useExpectedChain() {
  const { chainId, isConnected } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const isWrongChain =
    isConnected && typeof chainId === "number" && chainId !== EXPECTED_CHAIN_ID;

  return {
    currentChainId: chainId,
    currentChainName: chainName(chainId),
    expectedChain: EXPECTED_CHAIN,
    expectedChainId: EXPECTED_CHAIN_ID,
    isSwitching: isPending,
    isWrongChain,
    switchToExpectedChain: () => switchChainAsync({ chainId: EXPECTED_CHAIN_ID }),
  };
}
