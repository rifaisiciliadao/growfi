#!/usr/bin/env bash
# Shared helpers for post-deploy demo seed scripts.

GROWFI_ROOT="${GROWFI_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

find_cast() {
  if [ -n "${CAST_BIN:-}" ]; then
    printf '%s\n' "$CAST_BIN"
    return
  fi
  if command -v cast >/dev/null 2>&1; then
    command -v cast
    return
  fi
  if [ -x "$HOME/.foundry/bin/cast" ]; then
    printf '%s\n' "$HOME/.foundry/bin/cast"
    return
  fi
  echo "missing cast; install Foundry or set CAST_BIN" >&2
  exit 1
}

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "missing required env: $name" >&2
    exit 1
  fi
}

latest_campaign_addresses() {
  local script_name="$1"
  local chain_id="${2:-11155111}"
  local broadcast_file="${3:-$GROWFI_ROOT/broadcast/$script_name/$chain_id/run-latest.json}"

  if [ ! -f "$broadcast_file" ]; then
    echo "broadcast file not found: $broadcast_file" >&2
    return 1
  fi

  jq -r '
    [
      .transactions[]
      | select((.function // "") | startswith("createCampaign("))
      | (.additionalContracts
          | map(select(.contractName == "TransparentUpgradeableProxy"))
          | .[0].address)
    ]
    | .[]
  ' "$broadcast_file"
}

latest_campaign_address_at() {
  local script_name="$1"
  local index="${2:-0}"
  local chain_id="${3:-11155111}"
  local address

  address="$(latest_campaign_addresses "$script_name" "$chain_id" | sed -n "$((index + 1))p")"
  if [ -z "$address" ] || [ "$address" = "null" ]; then
    echo "could not resolve campaign #$index from $script_name broadcast" >&2
    return 1
  fi
  printf '%s\n' "$address"
}
