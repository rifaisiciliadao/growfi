import assert from "node:assert/strict";
import test from "node:test";
import { mainnet, sepolia } from "viem/chains";
import { rpcUrlForChain } from "./snapshot.js";

test("rpcUrlForChain never falls back to a testnet RPC on mainnet", () => {
  assert.equal(
    rpcUrlForChain(mainnet.id, { SEPOLIA_RPC_URL: "https://wrong.example" }),
    "https://ethereum-rpc.publicnode.com",
  );
});

test("rpcUrlForChain uses chain-specific and social RPC URLs", () => {
  assert.equal(
    rpcUrlForChain(mainnet.id, {
      MAINNET_RPC_URL: "https://mainnet.example",
      RPC_URL: "https://generic.example",
    }),
    "https://mainnet.example",
  );
  assert.equal(
    rpcUrlForChain(sepolia.id, {
      SOCIAL_RPC_URLS: "https://sepolia-a.example,https://sepolia-b.example",
    }),
    "https://sepolia-a.example",
  );
});
