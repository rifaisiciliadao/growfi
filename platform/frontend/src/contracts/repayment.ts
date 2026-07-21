import { keccak256, toBytes } from "viem";

export const REPAYMENT_MODULE_KIND = keccak256(toBytes("growfi.repayment.v1"));
export const REPAYMENT_MODULE_TYPE = keccak256(toBytes("growfi.type.repayment"));

export const campaignModuleHostAbi = [
  {
    type: "function",
    name: "moduleSlot",
    stateMutability: "view",
    inputs: [{ name: "moduleType", type: "bytes32" }],
    outputs: [
      { name: "impl", type: "address" },
      { name: "kind", type: "bytes32" },
      { name: "metadataURI", type: "string" },
      { name: "attachedAt", type: "uint64" },
      { name: "enabled", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "attachModule",
    stateMutability: "nonpayable",
    inputs: [
      { name: "moduleType", type: "bytes32" },
      { name: "kind", type: "bytes32" },
      { name: "impl", type: "address" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setModuleEnabled",
    stateMutability: "nonpayable",
    inputs: [
      { name: "moduleType", type: "bytes32" },
      { name: "enabled", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "selectorToType",
    stateMutability: "view",
    inputs: [{ name: "selector", type: "bytes4" }],
    outputs: [{ name: "moduleType", type: "bytes32" }],
  },
] as const;

export const repaymentModuleAbi = [
  {
    type: "function",
    name: "initializeRepaymentByProducer",
    stateMutability: "nonpayable",
    inputs: [{ name: "initialBonusPerCt", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "fundPool",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawUnusedPool",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setBonusPerCt",
    stateMutability: "nonpayable",
    inputs: [{ name: "newBonusPerCt", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "poolBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "principalPerCt",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "bonusPerCt",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "repaymentProtocolFeeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint16" }],
  },
  {
    type: "function",
    name: "payoutPerCt",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "netPayoutPerCt",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "claimedByUser",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "quoteRepayment",
    stateMutability: "view",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "quoteRepaymentGross",
    stateMutability: "view",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "quoteRepaymentProtocolFee",
    stateMutability: "view",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "redeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "unstakeFirst", type: "uint256[]" },
    ],
    outputs: [],
  },
] as const;
