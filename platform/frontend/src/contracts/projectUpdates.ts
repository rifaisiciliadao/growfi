import { keccak256, toBytes } from "viem";

export const PROJECT_UPDATES_MODULE_KIND = keccak256(
  toBytes("growfi.project.updates.v1"),
);
export const PROJECT_UPDATES_MODULE_TYPE = keccak256(
  toBytes("growfi.type.project.updates"),
);

export const projectUpdatesModuleAbi = [
  {
    type: "function",
    name: "postProjectUpdate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "metadataURI", type: "string" },
      { name: "contentHash", type: "bytes32" },
    ],
    outputs: [{ name: "updateId", type: "uint256" }],
  },
  {
    type: "function",
    name: "setProjectUpdateHidden",
    stateMutability: "nonpayable",
    inputs: [
      { name: "updateId", type: "uint256" },
      { name: "hidden", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "projectUpdateCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "visibleProjectUpdateCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "nextProjectUpdateId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
