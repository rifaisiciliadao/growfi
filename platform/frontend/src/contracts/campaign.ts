import type { Address } from "viem";

export const campaignTokenConfigAbi = [
  {
    type: "function",
    name: "tokenConfig",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "pricingMode", type: "uint8" },
          { name: "fixedRate", type: "uint256" },
          { name: "oracleFeed", type: "address" },
          { name: "paymentDecimals", type: "uint8" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
] as const;

export type CampaignTokenConfigResult =
  | readonly [number | bigint, bigint, Address, number | bigint, boolean]
  | {
      pricingMode?: number | bigint;
      fixedRate?: bigint;
      oracleFeed?: Address;
      paymentDecimals?: number | bigint;
      active?: boolean;
    };

export function readCampaignTokenConfig(raw: unknown) {
  const cfg = raw as CampaignTokenConfigResult | undefined;
  if (!cfg) return null;
  if (Array.isArray(cfg)) {
    return {
      pricingMode: Number(cfg[0] ?? 0),
      fixedRate: cfg[1] ?? 0n,
      active: Boolean(cfg[4]),
    };
  }
  const cfgObj = cfg as Exclude<CampaignTokenConfigResult, readonly unknown[]>;
  return {
    pricingMode: Number(cfgObj.pricingMode ?? 0),
    fixedRate: cfgObj.fixedRate ?? 0n,
    active: cfgObj.active ?? false,
  };
}
