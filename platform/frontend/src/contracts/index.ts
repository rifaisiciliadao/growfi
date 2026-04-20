import CampaignFactoryAbi from "./abis/CampaignFactory.json";
import CampaignAbi from "./abis/Campaign.json";
import CampaignTokenAbi from "./abis/CampaignToken.json";
import StakingVaultAbi from "./abis/StakingVault.json";
import YieldTokenAbi from "./abis/YieldToken.json";
import HarvestManagerAbi from "./abis/HarvestManager.json";
import CampaignRegistryAbi from "./abis/CampaignRegistry.json";
import ProducerRegistryAbi from "./abis/ProducerRegistry.json";
import type { Address } from "viem";

export const abis = {
  CampaignFactory: CampaignFactoryAbi,
  Campaign: CampaignAbi,
  CampaignToken: CampaignTokenAbi,
  StakingVault: StakingVaultAbi,
  YieldToken: YieldTokenAbi,
  HarvestManager: HarvestManagerAbi,
  CampaignRegistry: CampaignRegistryAbi,
  ProducerRegistry: ProducerRegistryAbi,
} as const;

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 84532);

export const addresses: Record<
  number,
  {
    factory: Address;
    usdc: Address;
    registry: Address;
    producerRegistry: Address;
  }
> = {
  // Base Sepolia (live testnet deployment, see CONTRACTS.md)
  84532: {
    factory:
      (process.env.NEXT_PUBLIC_FACTORY_ADDRESS as Address) ||
      "0x3fA41528a22645Bef478E9eBae83981C02e98f74",
    usdc:
      (process.env.NEXT_PUBLIC_USDC_ADDRESS as Address) ||
      "0x32C344Dc9713d904442d0E5B0d2b7994E52B0d4E",
    registry:
      (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as Address) ||
      "0xb0Ba4660b2D136BF087FA9bf0aec946f0a87597e",
    producerRegistry:
      (process.env.NEXT_PUBLIC_PRODUCER_REGISTRY_ADDRESS as Address) ||
      "0x702915469f66415C70b4203b40ab9A97203D979b",
  },
  // Base Mainnet (future)
  8453: {
    factory:
      (process.env.NEXT_PUBLIC_FACTORY_ADDRESS as Address) ||
      "0x0000000000000000000000000000000000000000",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    registry:
      (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as Address) ||
      "0x0000000000000000000000000000000000000000",
    producerRegistry:
      (process.env.NEXT_PUBLIC_PRODUCER_REGISTRY_ADDRESS as Address) ||
      "0x0000000000000000000000000000000000000000",
  },
};

export function getAddresses(chainId: number = CHAIN_ID) {
  return addresses[chainId] || addresses[84532];
}
