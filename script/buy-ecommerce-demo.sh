#!/usr/bin/env bash
set -euo pipefail

: "${BACKEND_URL:=https://growfi.dev}"
: "${CAMPAIGN_ADDRESS:?Set CAMPAIGN_ADDRESS}"
: "${USDC_ADDRESS:?Set USDC_ADDRESS}"
: "${RPC_URL:?Set RPC_URL}"
: "${BOB_PRIVATE_KEY:?Set BOB_PRIVATE_KEY}"

SKU_ID="${SKU_ID:-$(cast keccak "olive-oil-500ml")}"
ORDER_EMAIL="${ORDER_EMAIL:-sebastiano.cataudo@gmail.com}"
ORDER_NAME="${ORDER_NAME:-GrowFi Demo Buyer}"
ORDER_SHIPPING="${ORDER_SHIPPING:-Sepolia checkout smoke test}"
QUANTITY="${QUANTITY:-1}"
PRODUCT_NAME="${PRODUCT_NAME:-Extra virgin olive oil 500ml}"
CAMPAIGN_NAME="${CAMPAIGN_NAME:-Ecommerce Olive Shop Demo}"

buyer="$(cast wallet address --private-key "$BOB_PRIVATE_KEY")"
quote="$(cast call "$CAMPAIGN_ADDRESS" "quoteSku(bytes32,uint256)(uint256,uint256,uint256,uint256)" "$SKU_ID" "$QUANTITY" --rpc-url "$RPC_URL")"
gross="$(awk 'NR==1{print $1}' <<<"$quote")"
protocol_fee="$(awk 'NR==2{print $1}' <<<"$quote")"
repayment_allocated="$(awk 'NR==3{print $1}' <<<"$quote")"
producer_net="$(awk 'NR==4{print $1}' <<<"$quote")"

cast send "$USDC_ADDRESS" \
  "mint(address,uint256)" \
  "$buyer" \
  "$gross" \
  --rpc-url "$RPC_URL" \
  --private-key "$BOB_PRIVATE_KEY" >/dev/null

cast send "$USDC_ADDRESS" \
  "approve(address,uint256)" \
  "$CAMPAIGN_ADDRESS" \
  "$gross" \
  --rpc-url "$RPC_URL" \
  --private-key "$BOB_PRIVATE_KEY" >/dev/null

draft_payload="$(
  jq -n \
    --arg campaign "$CAMPAIGN_ADDRESS" \
    --arg buyer "$buyer" \
    --arg skuId "$SKU_ID" \
    --arg quantity "$QUANTITY" \
    --arg email "$ORDER_EMAIL" \
    --arg name "$ORDER_NAME" \
    --arg notes "$ORDER_SHIPPING" \
    --arg gross "$gross" \
    --arg protocolFee "$protocol_fee" \
    --arg repaymentAllocated "$repayment_allocated" \
    --arg producerNet "$producer_net" \
    --arg productName "$PRODUCT_NAME" \
    '{campaign:$campaign,buyer:$buyer,skuId:$skuId,quantity:$quantity,customer:{email:$email,name:$name},fulfillment:{notes:$notes},checkout:{gross:$gross,protocolFee:$protocolFee,repaymentAllocated:$repaymentAllocated,producerNet:$producerNet},metadata:{productName:$productName}}'
)"
order_hash="$(
  curl -sS -X POST "$BACKEND_URL/api/ecommerce/order-draft" \
    -H "content-type: application/json" \
    -d "$draft_payload" | jq -r '.orderHash'
)"
if [[ "$order_hash" == "null" || -z "$order_hash" ]]; then
  echo "order draft failed" >&2
  exit 1
fi

tx_hash="$(
  cast send "$CAMPAIGN_ADDRESS" \
    "buySku(bytes32,uint256,bytes32)" \
    "$SKU_ID" \
    "$QUANTITY" \
    "$order_hash" \
    --rpc-url "$RPC_URL" \
    --private-key "$BOB_PRIVATE_KEY" \
    --json | jq -r '.transactionHash'
)"

receipt_payload="$(
  jq -n \
    --arg email "$ORDER_EMAIL" \
    --arg campaignName "$CAMPAIGN_NAME" \
    --arg productName "$PRODUCT_NAME" \
    --arg quantity "$QUANTITY" \
    --arg paymentAmount "$(cast to-unit "$gross" 6)" \
    --arg paymentToken "USDC" \
    --arg protocolFee "$(cast to-unit "$protocol_fee" 6)" \
    --arg repaymentAllocated "$(cast to-unit "$repayment_allocated" 6)" \
    --arg producerNet "$(cast to-unit "$producer_net" 6)" \
    --arg orderHash "$order_hash" \
    --arg txHash "$tx_hash" \
    --arg txUrl "https://sepolia.etherscan.io/tx/$tx_hash" \
    --arg buyer "$buyer" \
    --arg shippingSummary "$ORDER_SHIPPING" \
    '{email:$email,campaignName:$campaignName,productName:$productName,quantity:$quantity,paymentAmount:$paymentAmount,paymentToken:$paymentToken,protocolFee:$protocolFee,repaymentAllocated:$repaymentAllocated,producerNet:$producerNet,orderHash:$orderHash,txHash:$txHash,txUrl:$txUrl,buyer:$buyer,shippingSummary:$shippingSummary}'
)"
receipt_response="$(
  curl -sS -X POST "$BACKEND_URL/api/ecommerce/purchase-receipt" \
    -H "content-type: application/json" \
    -d "$receipt_payload"
)"

echo "buyer=$buyer"
echo "sku_id=$SKU_ID"
echo "order_hash=$order_hash"
echo "tx_hash=$tx_hash"
echo "receipt_response=$receipt_response"
