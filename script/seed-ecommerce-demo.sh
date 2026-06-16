#!/usr/bin/env bash
# Seeds metadata and ecommerce catalog for the Sepolia ecommerce demo campaign.
# CAMPAIGN_ADDRESS is optional; when omitted, the script reads the latest
# CreateEcommerceCampaignSepolia broadcast for the active CHAIN_ID.
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
  CAMPAIGN_ADDRESS="$(latest_campaign_address_at "CreateEcommerceCampaignSepolia.s.sol" 0 "$CHAIN_ID")"
fi

require_env PRIVATE_KEY
require_env RPC_URL
require_env REGISTRY_ADDRESS
require_env CAMPAIGN_ADDRESS

SKU_ID="${SKU_ID:-$("$CAST_BIN" keccak "olive-oil-500ml")}"
IMAGE_URL="${IMAGE_URL:-https://growfi.dev/investors-olive-hero.jpg}"
PRODUCT_NAME="${PRODUCT_NAME:-Extra virgin olive oil 500ml}"
CAMPAIGN_NAME="${CAMPAIGN_NAME:-Ecommerce Olive Shop Demo}"

metadata_payload="$(
  jq -n \
    --arg name "$CAMPAIGN_NAME" \
    --arg description "A Sepolia demo campaign with an ecommerce module: buyers can purchase bottled olive oil on-chain and 10% of each order funds the campaign repayment pool." \
    --arg location "Sicily, Italy" \
    --arg productType "tree:olive-oil" \
    --arg imageUrl "$IMAGE_URL" \
    '{name:$name,description:$description,location:$location,productType:$productType,imageUrl:$imageUrl}'
)"
metadata_url="$(
  curl -sS -X POST "$BACKEND_URL/api/metadata" \
    -H "content-type: application/json" \
    -d "$metadata_payload" | jq -r '.url'
)"
if [[ "$metadata_url" == "null" || -z "$metadata_url" ]]; then
  echo "metadata upload failed" >&2
  exit 1
fi

catalog_payload="$(
  jq -n \
    --arg campaign "$CAMPAIGN_ADDRESS" \
    --arg skuId "$SKU_ID" \
    --arg name "$PRODUCT_NAME" \
    --arg image "$IMAGE_URL" \
    '{campaign:$campaign,title:"Campaign shop",description:"On-chain checkout for products reserved from this campaign.",currency:"USDC",repaymentAllocationBps:1000,items:[{skuId:$skuId,name:$name,description:"Cold-pressed Sicilian olive oil reserved from the campaign shop.",image:$image,unit:"bottle"}]}'
)"
catalog_url="$(
  curl -sS -X POST "$BACKEND_URL/api/ecommerce/catalog" \
    -H "content-type: application/json" \
    -d "$catalog_payload" | jq -r '.url'
)"
if [[ "$catalog_url" == "null" || -z "$catalog_url" ]]; then
  echo "catalog upload failed" >&2
  exit 1
fi

"$CAST_BIN" send "$REGISTRY_ADDRESS" \
  "setMetadata(address,string)" \
  "$CAMPAIGN_ADDRESS" \
  "$metadata_url" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY"

"$CAST_BIN" send "$CAMPAIGN_ADDRESS" \
  "setCatalogURI(string)" \
  "$catalog_url" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY"

echo "metadata_url=$metadata_url"
echo "catalog_url=$catalog_url"
echo "sku_id=$SKU_ID"
