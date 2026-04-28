#!/usr/bin/env bash
# finish-olive.sh — close the 2-actor OLIVE lifecycle E2E.
#
# Phase A (forge script OliveFinish.s.sol): endSeason, both actors claimYield,
# reportHarvest with a 1-leaf Merkle tree (root = leaf(bob, productAmount)),
# Alice redeemUSDC, Bob redeemProduct.
#
# Phase B (cast, here): producer depositUSDC + claimUSDC. Uses live view calls
# so no double-sim drift on `remainingDepositGross`.
#
# Required env (source .env):
#   PRIVATE_KEY         — Alice / producer / staker A
#   BOB_PRIVATE_KEY     — Bob / staker B
#   OLIVE_CAMPAIGN
#   OLIVE_STAKING_VAULT
#   OLIVE_HARVEST_MANAGER
#   OLIVE_YIELD_TOKEN
#   USDC_ADDRESS

set -euo pipefail

: "${PRIVATE_KEY:?PRIVATE_KEY required}"
: "${BOB_PRIVATE_KEY:?BOB_PRIVATE_KEY required}"
: "${OLIVE_CAMPAIGN:?}"
: "${OLIVE_STAKING_VAULT:?}"
: "${OLIVE_HARVEST_MANAGER:?}"
: "${OLIVE_YIELD_TOKEN:?}"
: "${USDC_ADDRESS:?}"

RPC="${RPC_URL:-https://base-sepolia-rpc.publicnode.com}"
ALICE=$(cast wallet address --private-key "$PRIVATE_KEY")

echo "=== PHASE A: endSeason + claims + report + redeems (forge script) ==="
forge script script/OliveFinish.s.sol --rpc-url "$RPC" --broadcast 2>&1 | tail -20

echo ""
echo "=== PHASE B: Alice deposits + claims USDC (cast, live state) ==="
run() { cast send --rpc-url "$RPC" --private-key "$PRIVATE_KEY" "$@" 2>&1 | grep -E "status|transactionHash" | head -2; }
view() { cast call --rpc-url "$RPC" "$@"; }

GROSS=$(view "$OLIVE_HARVEST_MANAGER" "remainingDepositGross(uint256)(uint256)" 1 | awk '{print $1}')
echo "gross deposit needed: $GROSS (6-dec USDC)"

echo "approve + depositUSDC"
run "$USDC_ADDRESS" "approve(address,uint256)" "$OLIVE_CAMPAIGN" "$GROSS"
run "$OLIVE_CAMPAIGN" "depositUSDC(uint256,uint256)" 1 "$GROSS"

USDC_BEFORE=$(view "$USDC_ADDRESS" "balanceOf(address)(uint256)" "$ALICE" | awk '{print $1}')
echo "claimUSDC"
run "$OLIVE_HARVEST_MANAGER" "claimUSDC(uint256)" 1
USDC_AFTER=$(view "$USDC_ADDRESS" "balanceOf(address)(uint256)" "$ALICE" | awk '{print $1}')
echo "USDC claimed by alice: $((USDC_AFTER - USDC_BEFORE))"

echo ""
echo "=== done ==="
