import CampaignFactoryAbi from "./abis/CampaignFactory.json";
import CampaignAbi from "./abis/Campaign.json";
import CampaignTokenAbi from "./abis/CampaignToken.json";
import StakingVaultAbi from "./abis/StakingVault.json";
import YieldTokenAbi from "./abis/YieldToken.json";
import HarvestManagerAbi from "./abis/HarvestManager.json";
import CampaignRegistryAbi from "./abis/CampaignRegistry.json";
import ProducerRegistryAbi from "./abis/ProducerRegistry.json";
import GrowTokenAbi from "./abis/GrowToken.json";
import GrowTreasuryAbi from "./abis/GrowTreasury.json";
import GrowMinterAbi from "./abis/GrowMinter.json";
import GrowFeeSplitterAbi from "./abis/GrowFeeSplitter.json";
import GrowStakingPoolAbi from "./abis/GrowStakingPool.json";
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
  GrowToken: GrowTokenAbi,
  GrowTreasury: GrowTreasuryAbi,
  GrowMinter: GrowMinterAbi,
  GrowFeeSplitter: GrowFeeSplitterAbi,
  GrowStakingPool: GrowStakingPoolAbi,
} as const;

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 1);

type ChainAddresses = {
  factory: Address;
  usdc: Address;
  usdt?: Address;
  dai?: Address;
  registry: Address;
  producerRegistry: Address;
  growToken?: Address;
  growTreasury?: Address;
  growMinter?: Address;
  growFeeSplitter?: Address;
  growStakingPool?: Address;
  repaymentImpl?: Address;
  ecommerceImpl?: Address;
  debtRestructuringImpl?: Address;
  proceedsSplitImpl?: Address;
  directIssueImpl?: Address;
  projectUpdatesImpl?: Address;
};

const ZERO: Address = "0x0000000000000000000000000000000000000000";
const LEGACY_MAINNET_PRODUCER_REGISTRY =
  "0x651fb29e69Bde3ADE988e8E75e9A3012272D2de5";
const MAINNET_PRODUCER_REGISTRY: Address =
  "0x267901bB08cb864b204D92185Fac8d6f9dee0F98";

function mainnetProducerRegistryAddress(): Address {
  const configured = process.env
    .NEXT_PUBLIC_PRODUCER_REGISTRY_ADDRESS as Address | undefined;
  if (
    !configured ||
    configured.toLowerCase() === LEGACY_MAINNET_PRODUCER_REGISTRY.toLowerCase()
  ) {
    return MAINNET_PRODUCER_REGISTRY;
  }
  return configured;
}

export const addresses: Record<number, ChainAddresses> = {
  // Local anvil — every address comes from .env.local at boot
  31337: {
    factory: (process.env.NEXT_PUBLIC_FACTORY_ADDRESS as Address) || ZERO,
    usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS as Address) || ZERO,
    usdt: process.env.NEXT_PUBLIC_USDT_ADDRESS as Address | undefined,
    dai: process.env.NEXT_PUBLIC_DAI_ADDRESS as Address | undefined,
    registry: (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as Address) || ZERO,
    producerRegistry:
      (process.env.NEXT_PUBLIC_PRODUCER_REGISTRY_ADDRESS as Address) || ZERO,
    growToken: process.env.NEXT_PUBLIC_GROW_TOKEN as Address | undefined,
    growTreasury: process.env.NEXT_PUBLIC_GROW_TREASURY as Address | undefined,
    growMinter: process.env.NEXT_PUBLIC_GROW_MINTER as Address | undefined,
    growFeeSplitter:
      process.env.NEXT_PUBLIC_GROW_FEE_SPLITTER as Address | undefined,
    growStakingPool:
      process.env.NEXT_PUBLIC_GROW_STAKING_POOL as Address | undefined,
    repaymentImpl:
      process.env.NEXT_PUBLIC_REPAYMENT_IMPL as Address | undefined,
    ecommerceImpl:
      process.env.NEXT_PUBLIC_ECOMMERCE_IMPL as Address | undefined,
    debtRestructuringImpl:
      process.env.NEXT_PUBLIC_DEBT_RESTRUCTURING_IMPL as Address | undefined,
    proceedsSplitImpl:
      process.env.NEXT_PUBLIC_PROCEEDS_SPLIT_IMPL as Address | undefined,
    directIssueImpl:
      process.env.NEXT_PUBLIC_DIRECT_ISSUE_IMPL as Address | undefined,
    projectUpdatesImpl:
      process.env.NEXT_PUBLIC_PROJECT_UPDATES_IMPL as Address | undefined,
  },
  // Base Sepolia (live testnet deployment, see CONTRACTS.md)
  84532: {
    factory:
      (process.env.NEXT_PUBLIC_FACTORY_ADDRESS as Address) ||
      "0xAf81c05747EDA1e1715fF23626ab83c3351dCfF6",
    usdc:
      (process.env.NEXT_PUBLIC_USDC_ADDRESS as Address) ||
      "0x784d2221e11f4E87FA031aAC15c168D27b5cCeb4",
    usdt: process.env.NEXT_PUBLIC_USDT_ADDRESS as Address | undefined,
    dai: process.env.NEXT_PUBLIC_DAI_ADDRESS as Address | undefined,
    registry:
      (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as Address) ||
      "0xf15E94B1db45eF645Ca611D62ECC6b10F5461515",
    producerRegistry:
      (process.env.NEXT_PUBLIC_PRODUCER_REGISTRY_ADDRESS as Address) ||
      "0x0ad6af458718963aEE1c7c4E142427e9c2C381A7",
    growToken:
      (process.env.NEXT_PUBLIC_GROW_TOKEN as Address | undefined) ||
      "0x88E1Fd001D09bE235BbEbeEd19e33E7abCF5385E",
    growTreasury:
      (process.env.NEXT_PUBLIC_GROW_TREASURY as Address | undefined) ||
      "0x66B3b38FCe61b0E5C96e9a1F0279321b14aC54D0",
    growMinter:
      (process.env.NEXT_PUBLIC_GROW_MINTER as Address | undefined) ||
      "0xa9D37cEF4756349ad2BE0023643122Af16868B57",
    growFeeSplitter:
      (process.env.NEXT_PUBLIC_GROW_FEE_SPLITTER as Address | undefined) ||
      "0xF0Ad36ef051742b4397048Aa4d5D7AB08F88FEf7",
    growStakingPool:
      process.env.NEXT_PUBLIC_GROW_STAKING_POOL as Address | undefined,
    repaymentImpl:
      process.env.NEXT_PUBLIC_REPAYMENT_IMPL as Address | undefined,
    ecommerceImpl:
      process.env.NEXT_PUBLIC_ECOMMERCE_IMPL as Address | undefined,
    debtRestructuringImpl:
      process.env.NEXT_PUBLIC_DEBT_RESTRUCTURING_IMPL as Address | undefined,
    proceedsSplitImpl:
      process.env.NEXT_PUBLIC_PROCEEDS_SPLIT_IMPL as Address | undefined,
    directIssueImpl:
      process.env.NEXT_PUBLIC_DIRECT_ISSUE_IMPL as Address | undefined,
    projectUpdatesImpl:
      process.env.NEXT_PUBLIC_PROJECT_UPDATES_IMPL as Address | undefined,
  },
  // Ethereum Sepolia (L1 testnet, pre-mainnet target)
  11155111: {
    factory: (process.env.NEXT_PUBLIC_FACTORY_ADDRESS as Address) || ZERO,
    usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS as Address) || ZERO,
    usdt: process.env.NEXT_PUBLIC_USDT_ADDRESS as Address | undefined,
    dai: process.env.NEXT_PUBLIC_DAI_ADDRESS as Address | undefined,
    registry: (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as Address) || ZERO,
    producerRegistry:
      (process.env.NEXT_PUBLIC_PRODUCER_REGISTRY_ADDRESS as Address) || ZERO,
    growToken: process.env.NEXT_PUBLIC_GROW_TOKEN as Address | undefined,
    growTreasury: process.env.NEXT_PUBLIC_GROW_TREASURY as Address | undefined,
    growMinter: process.env.NEXT_PUBLIC_GROW_MINTER as Address | undefined,
    growFeeSplitter:
      process.env.NEXT_PUBLIC_GROW_FEE_SPLITTER as Address | undefined,
    growStakingPool:
      process.env.NEXT_PUBLIC_GROW_STAKING_POOL as Address | undefined,
    repaymentImpl:
      (process.env.NEXT_PUBLIC_REPAYMENT_IMPL as Address | undefined) ||
      "0x1b0a76431b3CfD55b3be22497F03920C71623c47",
    ecommerceImpl:
      process.env.NEXT_PUBLIC_ECOMMERCE_IMPL as Address | undefined,
    debtRestructuringImpl:
      process.env.NEXT_PUBLIC_DEBT_RESTRUCTURING_IMPL as Address | undefined,
    proceedsSplitImpl:
      process.env.NEXT_PUBLIC_PROCEEDS_SPLIT_IMPL as Address | undefined,
    directIssueImpl:
      process.env.NEXT_PUBLIC_DIRECT_ISSUE_IMPL as Address | undefined,
    projectUpdatesImpl:
      process.env.NEXT_PUBLIC_PROJECT_UPDATES_IMPL as Address | undefined,
  },
  // Ethereum Mainnet (production target)
  1: {
    factory:
      (process.env.NEXT_PUBLIC_FACTORY_ADDRESS as Address) ||
      "0x81c2ecb09B8062cC9F3A4F8682318456304f4aE2",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // real USDC on mainnet
    usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // real USDT
    dai: "0x6B175474E89094C44Da98b954EedeAC495271d0F", // real DAI
    registry:
      (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as Address) ||
      "0xA3AEb95Ff4555E266aa1366000204a75FaD4142B",
    producerRegistry: mainnetProducerRegistryAddress(),
    growToken:
      (process.env.NEXT_PUBLIC_GROW_TOKEN as Address | undefined) ||
      "0xDcb4af0c05bc86D4F3C3351f30735b56a70ad725",
    growTreasury:
      (process.env.NEXT_PUBLIC_GROW_TREASURY as Address | undefined) ||
      "0x47ea5710ea674f5D653A59c96836E2d20288813a",
    growMinter:
      (process.env.NEXT_PUBLIC_GROW_MINTER as Address | undefined) ||
      "0x3D44d8c9D078f3aD92CacE67C09DdE9e8172A98B",
    growFeeSplitter:
      (process.env.NEXT_PUBLIC_GROW_FEE_SPLITTER as Address | undefined) ||
      "0x18b1E79F7b7a802f75e7F2261a9f7f2Bfbcd831f",
    growStakingPool:
      (process.env.NEXT_PUBLIC_GROW_STAKING_POOL as Address | undefined) ||
      "0xD4f6c69457F34332D3cd9ea287F69a91e84a803A",
    repaymentImpl:
      (process.env.NEXT_PUBLIC_REPAYMENT_IMPL as Address | undefined) ||
      "0x34326058FD53c773Fd7E67a20af17d73ae4d793A",
    ecommerceImpl:
      (process.env.NEXT_PUBLIC_ECOMMERCE_IMPL as Address | undefined) ||
      "0x5214CA79f4eb9298e506e2B3181aF0aD24B9Bd4c",
    debtRestructuringImpl:
      (process.env.NEXT_PUBLIC_DEBT_RESTRUCTURING_IMPL as Address | undefined) ||
      "0x6411BA1923A71E7dAA9BD738D31fF9F81B80319a",
    proceedsSplitImpl:
      (process.env.NEXT_PUBLIC_PROCEEDS_SPLIT_IMPL as Address | undefined) ||
      "0xb57073310911a902b082d4A7d0CD7dA26e27775D",
    directIssueImpl:
      (process.env.NEXT_PUBLIC_DIRECT_ISSUE_IMPL as Address | undefined) ||
      "0x236855EAFb5fbe864E3557f8b621950cBB46d816",
    projectUpdatesImpl:
      (process.env.NEXT_PUBLIC_PROJECT_UPDATES_IMPL as Address | undefined) ||
      "0x43FD484D3e12071a53181c3727354530230bEFCf",
  },
  // Base Mainnet (future)
  8453: {
    factory:
      (process.env.NEXT_PUBLIC_FACTORY_ADDRESS as Address) || ZERO,
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    registry:
      (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as Address) || ZERO,
    producerRegistry:
      (process.env.NEXT_PUBLIC_PRODUCER_REGISTRY_ADDRESS as Address) || ZERO,
  },
};

export function getAddresses(chainId: number = CHAIN_ID) {
  return addresses[chainId] || addresses[1];
}
