#!/usr/bin/env bash
# Seeds metadata for the Sepolia repayment demo campaign.
# CAMPAIGN_ADDRESS is optional; when omitted, the script reads the latest
# CreateRepaymentCampaignSepolia broadcast for the active CHAIN_ID.

set -euo pipefail
cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
source script/lib/seed-common.sh
CAST_BIN="$(find_cast)"

ENV_BACKEND_URL="${BACKEND_URL:-}"
ENV_RPC_URL="${RPC_URL:-}"
ENV_REGISTRY_ADDRESS="${REGISTRY_ADDRESS:-}"
ENV_CAMPAIGN_ADDRESS="${CAMPAIGN_ADDRESS:-}"
ENV_CHAIN_ID="${CHAIN_ID:-}"

# shellcheck disable=SC1091
if [ -f .env ]; then
  source .env
fi

BACKEND_URL="${ENV_BACKEND_URL:-${BACKEND_URL:-${NEXT_PUBLIC_BACKEND_URL:-https://growfi.dev}}}"
RPC_URL="${ENV_RPC_URL:-${RPC_URL:-}}"
REGISTRY_ADDRESS="${ENV_REGISTRY_ADDRESS:-${REGISTRY_ADDRESS:-${NEXT_PUBLIC_REGISTRY_ADDRESS:-}}}"
CAMPAIGN_ADDRESS="${ENV_CAMPAIGN_ADDRESS:-${CAMPAIGN_ADDRESS:-}}"
CHAIN_ID="${ENV_CHAIN_ID:-${CHAIN_ID:-${NEXT_PUBLIC_CHAIN_ID:-11155111}}}"

if [ -z "$CAMPAIGN_ADDRESS" ]; then
  CAMPAIGN_ADDRESS="$(latest_campaign_address_at "CreateRepaymentCampaignSepolia.s.sol" 0 "$CHAIN_ID")"
fi

require_env PRIVATE_KEY
require_env RPC_URL
require_env REGISTRY_ADDRESS
require_env CAMPAIGN_ADDRESS

WEBSITE_PUBLIC_DIR="${WEBSITE_PUBLIC_DIR:-$GROWFI_ROOT/../website-2.0/public}"
LOCAL_GRAPES="${LOCAL_GRAPES:-$WEBSITE_PUBLIC_DIR/grapes.jpeg}"
REMOTE_IMAGE="https://www.visitsicily.info/wp-content/uploads/2022/02/nebrodi.b.5.jpg"
TMP_IMG=$(mktemp -t growfi-repayment.XXXXXX.jpg)
trap 'rm -f "$TMP_IMG"' EXIT

if [ -f "$LOCAL_GRAPES" ]; then
  cp "$LOCAL_GRAPES" "$TMP_IMG"
else
  curl -sSL --max-time 60 "$REMOTE_IMAGE" -o "$TMP_IMG"
fi

SIZE=$(wc -c < "$TMP_IMG" | tr -d ' ')
if [ "$SIZE" -lt 1000 ]; then
  echo "campaign image too small: $SIZE bytes" >&2
  exit 1
fi

upload_image() {
  local file="$1"
  local res
  res=$(curl -sS --max-time 60 -X POST "$BACKEND_URL/api/upload" \
    -F "file=@${file};type=image/jpeg")
  echo "$res" | python3 -c 'import sys,json; print(json.load(sys.stdin)["url"])'
}

upload_metadata() {
  local body="$1"
  local res
  res=$(curl -sS --max-time 60 -X POST "$BACKEND_URL/api/metadata" \
    -H "Content-Type: application/json" \
    -d "$body")
  echo "$res" | python3 -c 'import sys,json; print(json.load(sys.stdin)["url"])'
}

echo "uploading repayment cover"
IMG_URL=$(upload_image "$TMP_IMG")
echo "cover: $IMG_URL"

echo "uploading repayment metadata"
META_URL=$(upload_metadata "$(cat <<EOF
{
  "name": "Repayment Vineyard Demo",
  "description": "Sepolia demo campaign with the Repayment module enabled. The grower funds a dedicated USDC pool so holders can burn free RPAY campaign tokens for a principal-plus-bonus repayment while liquidity remains available.",
  "location": "Etna, Catania, Sicily, Italy",
  "productType": "wine",
  "imageUrl": "$IMG_URL"
}
EOF
)")
echo "metadata: $META_URL"

echo "setting campaign metadata"
"$CAST_BIN" send "$REGISTRY_ADDRESS" \
  "setMetadata(address,string)" "$CAMPAIGN_ADDRESS" "$META_URL" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null

echo "repayment demo seeded"
echo "campaign: https://sepolia.etherscan.io/address/$CAMPAIGN_ADDRESS"
echo "metadata: $META_URL"
