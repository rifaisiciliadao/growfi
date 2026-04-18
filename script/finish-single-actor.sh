#!/usr/bin/env bash
# finish-single-actor.sh — close a 1-actor campaign E2E via cast (no forge script)
#
# Why cast and not a forge script: `forge script --broadcast` runs a second
# simulation pass for gas estimation. Between the initial sim and the re-sim
# each tx is re-played against a mildly divergent state (block.timestamp
# drifts), which breaks any step whose tx-encoded argument was computed from
# a VIEW called earlier in the script (e.g. `remainingDepositGross` after
# `redeemUSDC`). Cast does one real tx at a time, reading live chain state.
#
# Usage:
#   source .env                    # or export vars manually
#   ./script/finish-single-actor.sh $CAMPAIGN $STAKING_VAULT $HARVEST_MANAGER $YIELD_TOKEN
#
# Required env:
#   PRIVATE_KEY       — producer + staker (same wallet)
#   USDC_ADDRESS      — USDC / MockUSDC
#   RPC_URL           — defaults to base-sepolia-rpc.publicnode.com

set -euo pipefail

CAMPAIGN="${1:?campaign address required}"
VAULT="${2:?staking vault address required}"
HM="${3:?harvest manager address required}"
YT="${4:?yield token address required}"

: "${PRIVATE_KEY:?PRIVATE_KEY env var required}"
: "${USDC_ADDRESS:?USDC_ADDRESS env var required}"
RPC="${RPC_URL:-https://base-sepolia-rpc.publicnode.com}"
REPORTED_VALUE_WEI="${REPORTED_VALUE_WEI:-1000000000000000000000}" # 1_000e18 = $1,000 default

ME=$(cast wallet address --private-key "$PRIVATE_KEY")
echo "--- finish-single-actor ---"
echo "actor          : $ME"
echo "campaign       : $CAMPAIGN"
echo "reported value : $REPORTED_VALUE_WEI (wei, 18-dec USD)"

run() { cast send --rpc-url "$RPC" --private-key "$PRIVATE_KEY" "$@" 2>&1 | grep -E "status|transactionHash" | head -2; }
view() { cast call --rpc-url "$RPC" "$@"; }

echo ""
echo "[1/6] endSeason (producer)"
run "$CAMPAIGN" "endSeason()"

echo "[2/6] claimYield(0) (staker)"
run "$VAULT" "claimYield(uint256)" 0

YIELD=$(view "$YT" "balanceOf(address)(uint256)" "$ME" | awk '{print $1}')
echo "       yield balance: $YIELD"

echo "[3/6] reportHarvest (root=0x0, units=0 → pure USDC)"
run "$HM" "reportHarvest(uint256,uint256,bytes32,uint256)" \
    1 "$REPORTED_VALUE_WEI" \
    0x0000000000000000000000000000000000000000000000000000000000000000 \
    0

echo "[4/6] redeemUSDC(1, $YIELD) (staker)"
run "$HM" "redeemUSDC(uint256,uint256)" 1 "$YIELD"

GROSS=$(view "$HM" "remainingDepositGross(uint256)(uint256)" 1 | awk '{print $1}')
echo "       gross deposit needed: $GROSS (6-dec USDC)"

echo "[5/6] approve + depositUSDC($GROSS)"
run "$USDC_ADDRESS" "approve(address,uint256)" "$HM" "$GROSS"
run "$HM" "depositUSDC(uint256,uint256)" 1 "$GROSS"

USDC_BEFORE=$(view "$USDC_ADDRESS" "balanceOf(address)(uint256)" "$ME" | awk '{print $1}')
echo "[6/6] claimUSDC(1)"
run "$HM" "claimUSDC(uint256)" 1
USDC_AFTER=$(view "$USDC_ADDRESS" "balanceOf(address)(uint256)" "$ME" | awk '{print $1}')
CLAIMED=$((USDC_AFTER - USDC_BEFORE))
echo "       USDC claimed: $CLAIMED (6-dec)"

echo ""
echo "--- done ---"
