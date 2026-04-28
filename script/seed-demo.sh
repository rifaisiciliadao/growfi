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
#   CAMPAIGN_IMAGE_URL          remote URL for the campaign cover (default: nebrodi.b.5)
#   PRODUCER_LOGO_PATH          local path for the producer avatar (default: rifailogo.jpg)
#
# Usage:
#   bash script/seed-demo.sh

set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source .env

BACKEND_URL="${BACKEND_URL:-https://growfi.dev}"
# Defaults set explicitly to known-good assets so re-runs always land the
# same brand image, instead of "whatever stock photo URL happens to work
# today" (Unsplash silently 404s on hotlinks → uploads end up as 29-byte
# HTML stubs, the bug we hit on the first run).
CAMPAIGN_IMAGE_URL="${CAMPAIGN_IMAGE_URL:-https://www.visitsicily.info/wp-content/uploads/2022/02/nebrodi.b.5.jpg}"
PRODUCER_LOGO_PATH="${PRODUCER_LOGO_PATH:-/Users/turinglabs/GIT/@rifaisicilia/website-2.0/public/rifailogo.jpg}"

# ---------- Resolve campaign address from on-chain if not supplied ----------
if [[ -z "${CAMPAIGN_ADDRESS:-}" ]]; then
  CAMPAIGN_ADDRESS=$(cast call "$FACTORY_ADDRESS" \
    "campaigns(uint256)(address,address,address,address,address,address,uint256)" 0 \
    --rpc-url "$RPC_URL" | head -1)
fi
echo "▸ campaign  : $CAMPAIGN_ADDRESS"
echo "▸ producer  : $DEPLOYER_ADDRESS"
echo "▸ backend   : $BACKEND_URL"

# ---------- 1. Fetch the campaign cover image ----------
TMP_CAMPAIGN_IMG=$(mktemp -t growfi-campaign.XXXXXX.jpg)
TMP_LOGO=$(mktemp -t growfi-logo.XXXXXX.jpg)
trap 'rm -f "$TMP_CAMPAIGN_IMG" "$TMP_LOGO"' EXIT
echo "▸ fetching campaign image → $TMP_CAMPAIGN_IMG"
curl -sSL --max-time 60 "$CAMPAIGN_IMAGE_URL" -o "$TMP_CAMPAIGN_IMG"
# Sanity check — DO Spaces silently accepts whatever bytes you POST, so a
# 29-byte HTML 404 will upload "successfully" as a broken jpg. Verify the
# magic bytes locally before proceeding.
SIZE=$(wc -c < "$TMP_CAMPAIGN_IMG" | tr -d ' ')
if [[ "$SIZE" -lt 1000 ]]; then
  echo "✗ campaign image fetch returned only $SIZE bytes — refusing to upload junk"
  echo "  (URL was: $CAMPAIGN_IMAGE_URL)"
  exit 1
fi
echo "  ↳ ${SIZE} bytes"

# ---------- 2a. Upload campaign cover to DO Spaces via backend ----------
echo "▸ POST $BACKEND_URL/api/upload (campaign cover)"
UPLOAD_RES=$(curl -sS --max-time 60 -X POST "$BACKEND_URL/api/upload" \
  -F "file=@${TMP_CAMPAIGN_IMG};type=image/jpeg")
IMG_PUBLIC_URL=$(echo "$UPLOAD_RES" | python3 -c 'import sys,json; print(json.load(sys.stdin)["url"])')
echo "  ↳ $IMG_PUBLIC_URL"

# ---------- 2b. Upload producer logo (Rifai Sicilia) ----------
if [[ ! -f "$PRODUCER_LOGO_PATH" ]]; then
  echo "✗ producer logo not found at $PRODUCER_LOGO_PATH"
  exit 1
fi
cp "$PRODUCER_LOGO_PATH" "$TMP_LOGO"
echo "▸ POST $BACKEND_URL/api/upload (producer logo)"
LOGO_RES=$(curl -sS --max-time 60 -X POST "$BACKEND_URL/api/upload" \
  -F "file=@${TMP_LOGO};type=image/jpeg")
LOGO_PUBLIC_URL=$(echo "$LOGO_RES" | python3 -c 'import sys,json; print(json.load(sys.stdin)["url"])')
echo "  ↳ $LOGO_PUBLIC_URL"

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
PROFILE_RES=$(curl -sS --max-time 60 -X POST "$BACKEND_URL/api/producer" \
  -H "Content-Type: application/json" \
  -d "$(cat <<EOF
{
  "name": "Rifai Sicilia DAO",
  "bio": "Regenerative-finance host DAO bootstrapping Sicily's first syntropic agroforestry vineyards, olive groves, and citrus orchards onchain.",
  "avatar": "$LOGO_PUBLIC_URL",
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
