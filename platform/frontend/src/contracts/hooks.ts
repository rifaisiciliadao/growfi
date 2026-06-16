"use client";

import { useReadContract, useReadContracts } from "wagmi";
import type { Address } from "viem";
import { abis, CHAIN_ID, getAddresses } from "./index";

const factoryAbi = abis.CampaignFactory as never;
const campaignAbi = abis.Campaign as never;
const stakingAbi = abis.StakingVault as never;
const WAGMI_CHAIN_ID = CHAIN_ID as never;

/**
 * Returns array of all deployed campaign addresses
 */
export function useCampaignsList() {
  const { factory } = getAddresses();

  return useReadContract({
    address: factory,
    abi: factoryAbi,
    chainId: WAGMI_CHAIN_ID,
    functionName: "getCampaigns",
    query: {
      enabled:
        factory !== "0x0000000000000000000000000000000000000000",
    },
  }) as { data: Address[] | undefined; isLoading: boolean; error: Error | null };
}

export interface CampaignSummary {
  address: Address;
  producer: Address;
  pricePerToken: bigint;
  minCap: bigint;
  maxCap: bigint;
  currentSupply: bigint;
  fundingDeadline: bigint;
  state: number;
}

/**
 * Reads full state of a single Campaign contract.
 */
export function useCampaignData(address: Address | undefined) {
  return useReadContracts({
    contracts: address
      ? [
          { address, abi: campaignAbi, chainId: WAGMI_CHAIN_ID, functionName: "producer" },
          { address, abi: campaignAbi, chainId: WAGMI_CHAIN_ID, functionName: "pricePerToken" },
          { address, abi: campaignAbi, chainId: WAGMI_CHAIN_ID, functionName: "minCap" },
          { address, abi: campaignAbi, chainId: WAGMI_CHAIN_ID, functionName: "maxCap" },
          { address, abi: campaignAbi, chainId: WAGMI_CHAIN_ID, functionName: "currentSupply" },
          { address, abi: campaignAbi, chainId: WAGMI_CHAIN_ID, functionName: "fundingDeadline" },
          { address, abi: campaignAbi, chainId: WAGMI_CHAIN_ID, functionName: "state" },
          { address, abi: campaignAbi, chainId: WAGMI_CHAIN_ID, functionName: "campaignToken" },
          { address, abi: campaignAbi, chainId: WAGMI_CHAIN_ID, functionName: "stakingVault" },
          { address, abi: campaignAbi, chainId: WAGMI_CHAIN_ID, functionName: "harvestManager" },
        ]
      : [],
    query: { enabled: !!address },
  });
}

/**
 * Reads yield rate + totalStaked from StakingVault.
 */
export function useStakingData(vaultAddress: Address | undefined) {
  return useReadContracts({
    contracts: vaultAddress
      ? [
          { address: vaultAddress, abi: stakingAbi, chainId: WAGMI_CHAIN_ID, functionName: "totalStaked" },
          { address: vaultAddress, abi: stakingAbi, chainId: WAGMI_CHAIN_ID, functionName: "currentYieldRate" },
          { address: vaultAddress, abi: stakingAbi, chainId: WAGMI_CHAIN_ID, functionName: "currentSeasonId" },
        ]
      : [],
    query: { enabled: !!vaultAddress },
  });
}

export const CampaignStates = ["Funding", "Active", "Buyback", "Ended"] as const;
