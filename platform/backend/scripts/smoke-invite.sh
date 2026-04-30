#!/usr/bin/env bash
# End-to-end smoke for the invite gate against a local backend.
# Usage: ADMIN_API_KEY=… ./scripts/smoke-invite.sh [email]
#
# Runs:
#  1. POST /api/invite/request                 (public)
#  2. GET  /api/invite/check?address=<addr>    (wallet-connect lookup)
#  3. GET  /api/admin/invites?status=pending
#  4. POST /api/admin/invites/<addr>/approve
#  5. GET  /api/invite/check?address=<addr>    (now approved)
#
# Requires: jq, curl. Backend must be running on $BACKEND_URL (default :4001).

set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:4001}"
ADMIN_API_KEY="${ADMIN_API_KEY:-}"

if [ -z "$ADMIN_API_KEY" ]; then
  echo "ADMIN_API_KEY env var is required (matches the backend's .env)" >&2
  exit 1
fi

EMAIL="${1:-smoke+$(date +%s)@example.com}"
# Random-ish address per run (deterministic per invocation)
RNDHEX=$(printf '%040x' "$RANDOM$RANDOM$RANDOM" | tail -c 40)
ETH="0x${RNDHEX}"
TG="@smokeuser$RANDOM"

bold() { printf "\n\033[1m%s\033[0m\n" "$*"; }

bold "1) Submitting invite request: $EMAIL  (wallet $ETH)"
REQ=$(curl -fsS -X POST "$BACKEND_URL/api/invite/request" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg e "$EMAIL" --arg a "$ETH" --arg t "$TG" \
       '{email:$e, ethAddress:$a, telegram:$t}')")
echo "$REQ" | jq .

bold "2) Wallet-connect check (should be pending)"
curl -fsS "$BACKEND_URL/api/invite/check?address=$ETH" | jq .

bold "3) Admin list (pending)"
curl -fsS "$BACKEND_URL/api/admin/invites?status=pending&limit=5" \
  -H "X-Admin-Key: $ADMIN_API_KEY" | jq .

bold "4) Approving wallet $ETH"
curl -fsS -X POST "$BACKEND_URL/api/admin/invites/$ETH/approve" \
  -H "X-Admin-Key: $ADMIN_API_KEY" -H "Content-Type: application/json" -d '{}' | jq .

bold "5) Wallet-connect check (should be approved)"
curl -fsS "$BACKEND_URL/api/invite/check?address=$ETH" | jq .

bold "✓ smoke completed"
