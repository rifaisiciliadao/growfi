import { keccak256, toBytes } from "viem";

export const PROCEEDS_SPLIT_MODULE_KIND = keccak256(
  toBytes("growfi.proceeds.split.v1"),
);
export const PROCEEDS_SPLIT_MODULE_TYPE = keccak256(
  toBytes("growfi.type.proceeds.split"),
);
export const DIRECT_ISSUE_MODULE_KIND = keccak256(
  toBytes("growfi.direct.issue.v1"),
);
export const DIRECT_ISSUE_MODULE_TYPE = keccak256(
  toBytes("growfi.type.direct.issue"),
);

export const proceedsSplitModuleAbi = [
  {
    type: "function",
    name: "setProceedsSplit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "promoter", type: "address" },
      { name: "promoterBps", type: "uint16" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "clearProceedsSplit",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "proceedsSplit",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "active", type: "bool" },
      { name: "producer", type: "address" },
      { name: "promoter", type: "address" },
      { name: "promoterBps", type: "uint16" },
      { name: "producerBps", type: "uint16" },
    ],
  },
  {
    type: "function",
    name: "previewProceedsSplit",
    stateMutability: "view",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [
      { name: "toProducer", type: "uint256" },
      { name: "toPromoter", type: "uint256" },
    ],
  },
] as const;

export const directIssueModuleAbi = [
  {
    type: "function",
    name: "issueCampaignTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "newCurrentSupply", type: "uint256" }],
  },
  {
    type: "function",
    name: "issueCampaignTokensBatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [{ name: "newCurrentSupply", type: "uint256" }],
  },
  {
    type: "function",
    name: "quoteDirectIssue",
    stateMutability: "view",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [
      { name: "newCurrentSupply", type: "uint256" },
      { name: "fitsMaxCap", type: "bool" },
    ],
  },
] as const;
