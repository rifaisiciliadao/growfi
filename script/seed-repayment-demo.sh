#!/usr/bin/env bash
# Seeds metadata for the Sepolia repayment demo campaign.

set -euo pipefail
cd "$(dirname "$0")/.."

ENV_BACKEND_URL="${BACKEND_URL:-}"
ENV_RPC_URL="${RPC_URL:-}"
ENV_REGISTRY_ADDRESS="${REGISTRY_ADDRESS:-}"
ENV_CAMPAIGN_ADDRESS="${CAMPAIGN_ADDRESS:-}"

# shellcheck disable=SC1091
if [ -f .env ]; then
  source .env
fi

BACKEND_URL="${ENV_BACKEND_URL:-${BACKEND_URL:-${NEXT_PUBLIC_BACKEND_URL:-https://growfi.dev}}}"
RPC_URL="${ENV_RPC_URL:-${RPC_URL:-}}"
REGISTRY_ADDRESS="${ENV_REGISTRY_ADDRESS:-${REGISTRY_ADDRESS:-${NEXT_PUBLIC_REGISTRY_ADDRESS:-}}}"
CAMPAIGN_ADDRESS="${ENV_CAMPAIGN_ADDRESS:-${CAMPAIGN_ADDRESS:-}}"

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "missing required env: $name" >&2
    exit 1
  fi
}

require_env PRIVATE_KEY
require_env RPC_URL
require_env REGISTRY_ADDRESS
require_env CAMPAIGN_ADDRESS

LOCAL_GRAPES="/Users/turinglabs/GIT/@rifaisicilia/website-2.0/public/grapes.jpeg"
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
cast send "$REGISTRY_ADDRESS" \
  "setMetadata(address,string)" "$CAMPAIGN_ADDRESS" "$META_URL" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null

echo "repayment demo seeded"
echo "campaign: https://sepolia.etherscan.io/address/$CAMPAIGN_ADDRESS"
echo "metadata: $META_URL"
