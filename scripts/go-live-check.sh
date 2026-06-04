#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd "$SCRIPT_DIR/.." && pwd)

if [ -n "${HOME:-}" ] && [ -d "$HOME/.foundry/bin" ]; then
  PATH="$HOME/.foundry/bin:$PATH"
  export PATH
fi

info() {
  printf '\n==> %s\n' "$1"
}

pass() {
  printf 'OK: %s\n' "$1"
}

warn() {
  printf 'WARN: %s\n' "$1"
}

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

have() {
  command -v "$1" >/dev/null 2>&1
}

run_if_available() {
  label=$1
  shift

  info "$label"
  "$@"
  pass "$label"
}

package_script_exists() {
  package_json=$1
  script_name=$2

  node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
process.exit(pkg.scripts && pkg.scripts[process.argv[2]] ? 0 : 1);
" "$package_json" "$script_name"
}

package_runner() {
  dir=$1

  if [ -f "$dir/pnpm-lock.yaml" ] && have pnpm; then
    printf 'pnpm'
    return
  fi

  if [ -f "$dir/yarn.lock" ] && have yarn; then
    printf 'yarn'
    return
  fi

  if have npm; then
    printf 'npm'
    return
  fi

  fail "No supported JavaScript package runner found for $dir"
}

run_package_script() {
  dir=$1
  script_name=$2
  package_json="$dir/package.json"

  [ -f "$package_json" ] || return 0
  have node || fail "node is required to inspect $package_json"

  if package_script_exists "$package_json" "$script_name"; then
    runner=$(package_runner "$dir")
    case "$runner" in
      pnpm) (cd "$dir" && pnpm run "$script_name") ;;
      yarn) (cd "$dir" && yarn "$script_name") ;;
      npm) (cd "$dir" && npm run "$script_name") ;;
    esac
    pass "$dir: $script_name"
  else
    warn "$dir has no $script_name script"
  fi
}

check_git() {
  info "Git worktree"

  if ! have git; then
    warn "git is not available"
    return
  fi

  cd "$ROOT_DIR"
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
    warn "$ROOT_DIR is not inside a git worktree"
    return
  }

  status=$(git status --short)
  if [ -n "$status" ]; then
    printf '%s\n' "$status"
    if [ "${ALLOW_DIRTY:-0}" = "1" ]; then
      warn "worktree has uncommitted changes; continuing because ALLOW_DIRTY=1"
      pass "worktree dirtiness accepted for this run"
      return
    else
      fail "worktree has uncommitted changes"
    fi
  fi

  pass "worktree is clean"
}

check_secret_hygiene() {
  info "Secret hygiene"

  cd "$ROOT_DIR"

  if have git; then
    tracked_env=$(
      git ls-files \
        | grep -E '(^|/)\.env($|\.)' \
        | grep -Ev '(^|/)\.env\.(example|sample|template)$' \
        || true
    )
    if [ -n "$tracked_env" ]; then
      printf '%s\n' "$tracked_env"
      fail "tracked .env files found"
    fi
  fi

  suspicious_files=$(find "$ROOT_DIR" -type f \( -name '.env' -o -name '.env.production' -o -name '*.pem' -o -name '*.key' \) 2>/dev/null | grep -v '/node_modules/' || true)
  if [ -n "$suspicious_files" ]; then
    printf '%s\n' "$suspicious_files"
    warn "local secret-like files exist; confirm they are not tracked and are not copied into deployment artifacts"
  fi

  pass "secret hygiene check completed"
}

check_foundry() {
  foundry_dir=

  if [ -f "$ROOT_DIR/foundry.toml" ]; then
    foundry_dir=$ROOT_DIR
  elif [ -f "$ROOT_DIR/contracts/foundry.toml" ]; then
    foundry_dir=$ROOT_DIR/contracts
  fi

  [ -n "$foundry_dir" ] || {
    warn "No Foundry project detected"
    return
  }

  have forge || fail "forge is required for contract checks"

  foundry_test_cmd=${FOUNDRY_TEST_CMD:-forge test}
  run_if_available "Foundry tests: $foundry_test_cmd" sh -c "cd '$foundry_dir' && $foundry_test_cmd"
}

check_javascript_projects() {
  info "JavaScript projects"

  dirs=$ROOT_DIR
  for candidate in \
    "$ROOT_DIR"/frontend \
    "$ROOT_DIR"/backend \
    "$ROOT_DIR"/app \
    "$ROOT_DIR"/apps/* \
    "$ROOT_DIR"/packages/* \
    "$ROOT_DIR"/platform/frontend \
    "$ROOT_DIR"/platform/backend \
    "$ROOT_DIR"/platform/admin \
    "$ROOT_DIR"/platform/subgraph
  do
    [ -f "$candidate/package.json" ] && dirs="$dirs $candidate"
  done

  seen=
  for dir in $dirs; do
    [ -f "$dir/package.json" ] || continue
    case " $seen " in
      *" $dir "*) continue ;;
    esac
    seen="$seen $dir"

    info "Package checks: $dir"
    run_package_script "$dir" lint
    run_package_script "$dir" typecheck
    run_package_script "$dir" test
    run_package_script "$dir" build
  done
}

check_required_env_examples() {
  info "Environment templates"

  missing=
  for dir in \
    "$ROOT_DIR"/backend \
    "$ROOT_DIR"/frontend \
    "$ROOT_DIR"/app \
    "$ROOT_DIR"/platform/backend \
    "$ROOT_DIR"/platform/frontend \
    "$ROOT_DIR"/platform/admin \
    "$ROOT_DIR"/platform/subgraph
  do
    [ -d "$dir" ] || continue
    if [ ! -f "$dir/.env.example" ]; then
      missing="$missing $dir/.env.example"
    fi
  done

  if [ -n "$missing" ]; then
    printf '%s\n' "$missing"
    warn "Some service env templates are missing"
  else
    pass "service env templates found or no conventional service directories detected"
  fi
}

check_optional_live_inputs() {
  info "Live smoke inputs"

  [ -n "${RPC_URL:-}" ] || warn "RPC_URL is not set"
  [ -n "${GROW_TOKEN_ADDRESS:-}" ] || warn "GROW_TOKEN_ADDRESS is not set"
  [ -n "${GROWFI_FACTORY_ADDRESS:-}" ] || warn "GROWFI_FACTORY_ADDRESS is not set"
  [ -n "${GROWFI_BACKEND_URL:-}" ] || warn "GROWFI_BACKEND_URL is not set"
  [ -n "${GROWFI_FRONTEND_URL:-}" ] || warn "GROWFI_FRONTEND_URL is not set"
  [ -n "${UGRAPH_GRAPHQL_URL:-}" ] || warn "UGRAPH_GRAPHQL_URL is not set"

  if [ "${REQUIRE_LIVE_SMOKE:-0}" = "1" ]; then
    [ -n "${RPC_URL:-}" ] || fail "RPC_URL is required when REQUIRE_LIVE_SMOKE=1"
    [ -n "${GROW_TOKEN_ADDRESS:-}" ] || fail "GROW_TOKEN_ADDRESS is required when REQUIRE_LIVE_SMOKE=1"
    [ -n "${GROWFI_FACTORY_ADDRESS:-}" ] || fail "GROWFI_FACTORY_ADDRESS is required when REQUIRE_LIVE_SMOKE=1"
    [ -n "${GROWFI_BACKEND_URL:-}" ] || fail "GROWFI_BACKEND_URL is required when REQUIRE_LIVE_SMOKE=1"
    [ -n "${GROWFI_FRONTEND_URL:-}" ] || fail "GROWFI_FRONTEND_URL is required when REQUIRE_LIVE_SMOKE=1"
    [ -n "${UGRAPH_GRAPHQL_URL:-}" ] || fail "UGRAPH_GRAPHQL_URL is required when REQUIRE_LIVE_SMOKE=1"
  fi

  pass "live input check completed"
}

check_live_http() {
  [ -n "${GROWFI_BACKEND_URL:-}" ] || return 0
  have curl || fail "curl is required for backend smoke checks"

  run_if_available "Backend HTTP smoke" curl -fsS "$GROWFI_BACKEND_URL"
}

check_ugraph() {
  [ -n "${UGRAPH_GRAPHQL_URL:-}" ] || return 0
  have curl || fail "curl is required for UGraph smoke checks"

  info "UGraph GraphQL smoke"
  curl -fsS \
    -H 'content-type: application/json' \
    --data '{"query":"query { _meta { block { number } } }"}' \
    "$UGRAPH_GRAPHQL_URL" >/dev/null
  pass "UGraph GraphQL endpoint responds"
}

main() {
  cd "$ROOT_DIR"

  check_git
  check_secret_hygiene
  check_required_env_examples
  check_foundry
  check_javascript_projects
  check_optional_live_inputs
  check_live_http
  check_ugraph

  printf '\nGo-live checks completed. Review warnings before release.\n'
}

main "$@"
