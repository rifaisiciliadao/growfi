import type { Address } from "viem";
import { getAddresses } from "./index";

export type PricingMode = "fixed" | "oracle";

export interface KnownToken {
  symbol: string;
  name: string;
  addresses: Record<number, Address | null>;
  decimals: number;
  defaultMode: PricingMode;
  /** Chainlink feed (token/USD, 8 dec) per-chain. Null if the token has no oracle on that chain. */
  oracleFeed: Record<number, Address | null>;
  /** True = selectable in the UI right now. Others render disabled with "Coming soon". */
  enabled: boolean;
  /**
   * Token is a 1:1 USD stablecoin. When true, the /create form hides the
   * "Prezzo (per 1 $CAMP)" input for this token and derives `fixedRate`
   * directly from `pricePerToken` — so the producer only enters the USD
   * price once instead of re-typing it per stablecoin.
   */
  stableUsd?: boolean;
}

/**
 * Curated list of payment tokens shown to the producer in /create step 3.
 *
 * Only factory-approved, standard ERC20 payment assets are enabled. On
 * Ethereum mainnet the current policy allows USDC fixed-price campaigns.
 *
 * SECURITY INVARIANT: every entry MUST be a standard ERC20 — no
 * fee-on-transfer, no rebasing, no ERC777 hooks. `Campaign.buy` records the
 * declared `paymentAmount` in `purchases[]` assuming the contract receives
 * exactly that amount. A fee-on-transfer token silently accumulates a pool
 * shortfall that makes the last buyback refund revert with
 * `ERC20InsufficientBalance`. Producers can still manually whitelist
 * arbitrary ERC20s via `addAcceptedToken`, but this catalog will never
 * surface them. Regression: `test/PoolSecurity.t.sol`.
 */
export const KNOWN_TOKENS: KnownToken[] = [
  {
    symbol: "mUSDC",
    name: "Mock USDC (testnet)",
    // Sourced from the same env that drives factory.usdc + getAddresses().usdc.
    // Hardcoding here led to drift across redeploys (the KNOWN_TOKENS entry
    // pointed at an older mock while the factory was wired to a newer one),
    // which broke the BuyPanel "Mint mUSDC" button: selected.address ≠
    // mockUsdcAddress so the gating condition silently failed.
    addresses: {
      84532:
        (process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` | undefined) ||
        "0x784d2221e11f4E87FA031aAC15c168D27b5cCeb4",
      1: null,
      8453: null,
    },
    decimals: 6,
    defaultMode: "fixed",
    oracleFeed: { 84532: null, 1: null, 8453: null },
    enabled: true,
    stableUsd: true,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    addresses: {
      84532: null,
      1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
    decimals: 6,
    defaultMode: "fixed",
    oracleFeed: {
      // USDC/USD on Base Mainnet
      84532: null,
      1: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
      8453: "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B",
    },
    enabled: true,
    stableUsd: true,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    addresses: {
      84532: null,
      1: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      8453: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    },
    decimals: 6,
    defaultMode: "fixed",
    oracleFeed: { 84532: null, 1: null, 8453: null },
    enabled: false,
    stableUsd: true,
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    addresses: {
      84532: null,
      1: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      8453: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    },
    decimals: 18,
    defaultMode: "fixed",
    oracleFeed: { 84532: null, 1: null, 8453: null },
    enabled: false,
    stableUsd: true,
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    addresses: {
      84532: null,
      1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      8453: "0x4200000000000000000000000000000000000006",
    },
    decimals: 18,
    defaultMode: "oracle",
    oracleFeed: {
      // ETH/USD on Base Mainnet
      84532: null,
      1: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
      8453: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
    },
    enabled: false,
  },
  {
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    addresses: {
      84532: null,
      1: null,
      8453: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    },
    decimals: 8,
    defaultMode: "oracle",
    oracleFeed: {
      // BTC/USD on Base Mainnet
      84532: null,
      1: null,
      8453: "0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F",
    },
    enabled: false,
  },
];

export function getEnabledTokens(chainId?: number): KnownToken[] {
  const cid = chainId ?? Number(process.env.NEXT_PUBLIC_CHAIN_ID || 1);
  return KNOWN_TOKENS.filter(
    (t) => t.enabled && t.addresses[cid] !== null,
  );
}

export function getTokenBySymbol(symbol: string): KnownToken | undefined {
  return KNOWN_TOKENS.find((t) => t.symbol === symbol);
}

/** Resolve the address for a token on the active chain, or throw if missing. */
export function resolveTokenAddress(
  token: KnownToken,
  chainId?: number,
): Address {
  const cid = chainId ?? Number(process.env.NEXT_PUBLIC_CHAIN_ID || 1);
  const addr = token.addresses[cid];
  if (!addr) {
    throw new Error(
      `${token.symbol} is not deployed on chain ${cid}`,
    );
  }
  return addr;
}

/** Pricing-mode enum value matching the Solidity `Campaign.PricingMode`. */
export const PRICING_MODE_ENUM: Record<PricingMode, number> = {
  fixed: 0,
  oracle: 1,
};

export { getAddresses };
