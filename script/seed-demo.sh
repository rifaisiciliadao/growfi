#!/usr/bin/env bash
# seed-demo.sh — finishes the demo platform setup *automatically* after a
# fresh forge redeploy. Uploads campaign image + metadata to DO Spaces via
# the live backend, signs CampaignRegistry.setMetadata, uploads the
# producer profile, signs ProducerRegistry.setProfile, and (re)asserts
# the KYC bit. Idempotent — safe to re-run if anything wobbles mid-flight.
#
# Required env (sourced from .env):
#   PRIVATE_KEY                 alice (deployer + producer + factory owner)
#   DEPLOYER_ADDRESS            alice's checksummed address
#   FACTORY_ADDRESS             new factory proxy
#   REGISTRY_ADDRESS            CampaignRegistry
#   PRODUCER_REGISTRY_ADDRESS   ProducerRegistry
#   RPC_URL                     https://sepolia.base.org
#
# Optional:
#   CAMPAIGN_ADDRESS            override; otherwise we read campaigns(0) off the factory
#   BACKEND_URL                 default https://growfi.dev
#   IMAGE_URL                   stock image to mirror; default: a CC0 olive grove
#
# Usage:
#   bash script/seed-demo.sh

set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source .env

BACKEND_URL="${BACKEND_URL:-https://growfi.dev}"
# Public-domain olive-grove photo (Unsplash, no API key needed for direct CDN).
IMAGE_URL="${IMAGE_URL:-https://images.unsplash.com/photo-1528505693743-d76481fbb2ec?w=1600&q=80&fm=jpg}"

# ---------- Resolve campaign address from on-chain if not supplied ----------
if [[ -z "${CAMPAIGN_ADDRESS:-}" ]]; then
  CAMPAIGN_ADDRESS=$(cast call "$FACTORY_ADDRESS" \
    "campaigns(uint256)(address,address,address,address,address,address,uint256)" 0 \
    --rpc-url "$RPC_URL" | head -1)
fi
echo "▸ campaign  : $CAMPAIGN_ADDRESS"
echo "▸ producer  : $DEPLOYER_ADDRESS"
echo "▸ backend   : $BACKEND_URL"

# ---------- 1. Fetch the cover image to /tmp ----------
TMP_IMG=$(mktemp -t growfi-olive.XXXXXX.jpg)
trap 'rm -f "$TMP_IMG"' EXIT
echo "▸ fetching image → $TMP_IMG"
curl -sSL --max-time 60 "$IMAGE_URL" -o "$TMP_IMG"
test -s "$TMP_IMG" || { echo "✗ image fetch failed"; exit 1; }

# ---------- 2. Upload image to DO Spaces via backend ----------
echo "▸ POST $BACKEND_URL/api/upload"
UPLOAD_RES=$(curl -sS --max-time 60 -X POST "$BACKEND_URL/api/upload" \
  -F "file=@${TMP_IMG};type=image/jpeg")
IMG_PUBLIC_URL=$(echo "$UPLOAD_RES" | python3 -c 'import sys,json; print(json.load(sys.stdin)["url"])')
echo "  ↳ $IMG_PUBLIC_URL"

# ---------- 3. Upload campaign metadata JSON ----------
echo "▸ POST $BACKEND_URL/api/metadata"
META_RES=$(curl -sS --max-time 60 -X POST "$BACKEND_URL/api/metadata" \
  -H "Content-Type: application/json" \
  -d "$(cat <<EOF
{
  "name": "Olive IGP Sicily",
  "description": "Productive olive grove in southern Sicily, certified IGP. Proceeds fund 350,000 newly-tokenised young trees grown under syntropic agroforestry — investors receive a share of every annual harvest of premium extra-virgin olive oil starting in 2030.",
  "location": "Ragusa, Sicily, Italy",
  "productType": "olive-oil",
  "imageUrl": "$IMG_PUBLIC_URL"
}
EOF
)")
META_URL=$(echo "$META_RES" | python3 -c 'import sys,json; print(json.load(sys.stdin)["url"])')
echo "  ↳ $META_URL"

# ---------- 4. CampaignRegistry.setMetadata(campaign, metadataUrl) ----------
echo "▸ setMetadata on $REGISTRY_ADDRESS"
cast send "$REGISTRY_ADDRESS" \
  "setMetadata(address,string)" "$CAMPAIGN_ADDRESS" "$META_URL" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" \
  >/dev/null
echo "  ↳ ok"

# ---------- 5. Upload producer profile ----------
echo "▸ POST $BACKEND_URL/api/producer"
# Reuse the same image as a temp avatar — producer can swap it via UI.
PROFILE_RES=$(curl -sS --max-time 60 -X POST "$BACKEND_URL/api/producer" \
  -H "Content-Type: application/json" \
  -d "$(cat <<EOF
{
  "name": "Rifai Sicilia DAO",
  "bio": "Regenerative-finance host DAO bootstrapping Sicily's first syntropic agroforestry vineyards, olive groves, and citrus orchards onchain.",
  "avatar": "$IMG_PUBLIC_URL",
  "website": "https://rifaisicilia.com",
  "location": "Sicily, Italy"
}
EOF
)")
PROFILE_URL=$(echo "$PROFILE_RES" | python3 -c 'import sys,json; print(json.load(sys.stdin)["url"])')
echo "  ↳ $PROFILE_URL"

# ---------- 6. ProducerRegistry.setProfile(profileUrl) ----------
echo "▸ setProfile on $PRODUCER_REGISTRY_ADDRESS"
cast send "$PRODUCER_REGISTRY_ADDRESS" \
  "setProfile(string)" "$PROFILE_URL" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" \
  >/dev/null
echo "  ↳ ok"

# ---------- 7. Re-assert KYC (idempotent — already true after deploy step) ----------
KYC=$(cast call "$PRODUCER_REGISTRY_ADDRESS" "kyced(address)(bool)" "$DEPLOYER_ADDRESS" --rpc-url "$RPC_URL")
if [[ "$KYC" != "true" ]]; then
  echo "▸ setKyc(producer, true)"
  cast send "$PRODUCER_REGISTRY_ADDRESS" \
    "setKyc(address,bool)" "$DEPLOYER_ADDRESS" true \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" \
    >/dev/null
  echo "  ↳ ok"
else
  echo "▸ KYC already set ✓"
fi

echo ""
echo "✓ Demo seed complete."
echo "  campaign  : https://sepolia.basescan.org/address/$CAMPAIGN_ADDRESS"
echo "  metadata  : $META_URL"
echo "  profile   : $PROFILE_URL"
