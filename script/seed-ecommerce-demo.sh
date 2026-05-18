#!/usr/bin/env bash
set -euo pipefail

: "${BACKEND_URL:=https://growfi.dev}"
: "${CAMPAIGN_ADDRESS:?Set CAMPAIGN_ADDRESS}"
: "${REGISTRY_ADDRESS:?Set REGISTRY_ADDRESS}"
: "${RPC_URL:?Set RPC_URL}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY}"

SKU_ID="${SKU_ID:-$(cast keccak "olive-oil-500ml")}"
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

cast send "$REGISTRY_ADDRESS" \
  "setMetadata(address,string)" \
  "$CAMPAIGN_ADDRESS" \
  "$metadata_url" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY"

cast send "$CAMPAIGN_ADDRESS" \
  "setCatalogURI(string)" \
  "$catalog_url" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY"

echo "metadata_url=$metadata_url"
echo "catalog_url=$catalog_url"
echo "sku_id=$SKU_ID"
