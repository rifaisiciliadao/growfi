import { keccak256, toBytes } from "viem";

export const DEBT_RESTRUCTURING_MODULE_KIND = keccak256(
  toBytes("growfi.debt.restructuring.v1"),
);
export const DEBT_RESTRUCTURING_MODULE_TYPE = keccak256(
  toBytes("growfi.type.debt.restructuring"),
);

export const debtRestructuringModuleAbi = [
  {
    type: "function",
    name: "initializeDebtRestructuringByProducer",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "claimRestructuredCampaignTokens",
    stateMutability: "nonpayable",
    inputs: [{ name: "seasonId", type: "uint256" }],
    outputs: [{ name: "minted", type: "uint256" }],
  },
  {
    type: "function",
    name: "quoteRestructuredCampaignTokens",
    stateMutability: "view",
    inputs: [
      { name: "seasonId", type: "uint256" },
      { name: "holder", type: "address" },
    ],
    outputs: [
      { name: "usdcShortfall", type: "uint256" },
      { name: "campaignTokensOut", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "debtRestructuringStarted",
    stateMutability: "view",
    inputs: [{ name: "seasonId", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "restructuredCampaignTokensClaimed",
    stateMutability: "view",
    inputs: [
      { name: "seasonId", type: "uint256" },
      { name: "holder", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "restructuredUsdcShortfall",
    stateMutability: "view",
    inputs: [
      { name: "seasonId", type: "uint256" },
      { name: "holder", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;
