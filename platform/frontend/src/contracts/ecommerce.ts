import { keccak256, toBytes } from "viem";

export const ECOMMERCE_MODULE_KIND = keccak256(toBytes("growfi.ecommerce.v1"));
export const ECOMMERCE_MODULE_TYPE = keccak256(toBytes("growfi.type.ecommerce"));

export const ecommerceModuleAbi = [
  {
    type: "function",
    name: "initializeEcommerceByProducer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "initialProtocolFeeBps", type: "uint16" },
      { name: "initialCatalogURI", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setCatalogURI",
    stateMutability: "nonpayable",
    inputs: [{ name: "newCatalogURI", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setProtocolFeeBps",
    stateMutability: "nonpayable",
    inputs: [{ name: "newFeeBps", type: "uint16" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setRepaymentAllocationBps",
    stateMutability: "nonpayable",
    inputs: [{ name: "newBps", type: "uint16" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setSku",
    stateMutability: "nonpayable",
    inputs: [
      { name: "skuId", type: "bytes32" },
      { name: "priceUsdc", type: "uint256" },
      { name: "inventory", type: "uint256" },
      { name: "active", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setSkuActive",
    stateMutability: "nonpayable",
    inputs: [
      { name: "skuId", type: "bytes32" },
      { name: "active", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "buySku",
    stateMutability: "nonpayable",
    inputs: [
      { name: "skuId", type: "bytes32" },
      { name: "quantity", type: "uint256" },
      { name: "orderHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "quoteSku",
    stateMutability: "view",
    inputs: [
      { name: "skuId", type: "bytes32" },
      { name: "quantity", type: "uint256" },
    ],
    outputs: [
      { name: "gross", type: "uint256" },
      { name: "protocolFee", type: "uint256" },
      { name: "repaymentAllocation", type: "uint256" },
      { name: "producerNet", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "catalogURI",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "protocolFeeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint16" }],
  },
  {
    type: "function",
    name: "repaymentAllocationBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint16" }],
  },
  {
    type: "function",
    name: "grossSales",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "repaymentAllocated",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "sku",
    stateMutability: "view",
    inputs: [{ name: "skuId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "priceUsdc", type: "uint256" },
          { name: "inventory", type: "uint256" },
          { name: "sold", type: "uint256" },
          { name: "active", type: "bool" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "skuCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "skuAt",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ type: "bytes32" }],
  },
] as const;
