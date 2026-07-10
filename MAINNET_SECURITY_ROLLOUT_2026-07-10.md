# GrowFi Mainnet Security Rollout — 2026-07-10

This runbook covers the coordinated Ethereum mainnet contract upgrade, EAS
schema preparation, and application rollout for the July 2026 security fixes.
It is intentionally split into independently verifiable phases. Do not combine
the contract broadcast, EAS enablement, and public UI enablement into one step.

## Scope

The release fixes:

- cross-season phantom yield in `GrowfiStakingVault`;
- Treasury floor accounting for both liquid and Treasury-staked CampaignTokens,
  with a penalty-free Treasury-owned unstake path;
- indefinitely locked campaign escrow after the soft cap is met;
- social verification without wallet ownership proof;
- SSRF, including DNS rebinding and IPv4-transition address bypasses, in public
  website proof verification;
- unauthenticated and mutable redemption Merkle proof publication.

The contract rollout upgrades the Factory, Treasury, both existing staking
vaults, and the SaleClassic module used by existing and future campaigns. The
mainnet ProducerRegistry is an immutable pre-social deployment, so the EAS
phase deploys a V2 replacement and trustlessly imports legacy producer state.

## Fixed mainnet identities

- Factory proxy: `0x81c2ecb09B8062cC9F3A4F8682318456304f4aE2`
- Factory and ProxyAdmin owner EOA: `0xA229F3c9851E26fC9eA18157b88cd1CDA6F90e55`
- Legacy ProducerRegistry: `0x651fb29e69Bde3ADE988e8E75e9A3012272D2de5`
- ProducerRegistry V2: `0x267901bB08cb864b204D92185Fac8d6f9dee0F98`
- EAS: `0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587`
- EAS SchemaRegistry: `0xA7b39296258348C78294F95B872b282326A97BDF`
- Social schema UID: `0x78422879833ca667e9b3ea79d6aaa24328d751493bbd42c92d271d7e94f40caa`

The rollout scripts reject non-mainnet chains, unexpected owners, unexpected
campaign counts, and incompatible campaign state. The security upgrade is
resumable after a partial execution.

## Current deployment gates

The contract, ProducerRegistry V2, UGraph, application, and first live social
attestation rollouts are complete. The remaining operational gate is PAT
rotation:

- [x] Full Solidity suite passes.
- [x] Mainnet-fork rollout preserves live state.
- [x] Mainnet-fork rollout can be executed twice.
- [x] Backend tests and TypeScript build pass.
- [x] Frontend production build and lint pass.
- [x] ProducerRegistry V2 migration and EAS registration pass on a mainnet fork.
- [x] The production `.do/app.yaml` validates through authenticated
  DigitalOcean API access.
- [x] Owner credential derives exactly to the live owner EOA.
- [x] Exact contract rollout simulation passed at block `25501389`.
- [x] Contract rollout completed in blocks `25501399`-`25501432`.
- [x] Post-rollout preservation and resumability fork tests pass at block
  `25501433`.
- [x] Post-rollout implementation, ProxyAdmin, module, and campaign inventory
  passed at block `25501436`.
- [ ] Rotate every DigitalOcean PAT that was exposed during local diagnostics.
- [x] Production app ownership resolved: `growfi-mainnet`, id
  `9e4019f4-8dbc-4170-8546-ce7d8579e3a4`, under the DigitalOcean RIFAI team
  selector `i=b9d43f`.
- [x] The live spec was fetched and updated through authenticated RIFAI API
  access without relying on the stale saved contexts (`turinglabs` returns 401;
  `default` belongs to another team).
- [x] Dedicated backend verifier `0x5e55B7b90F26C980eFaCa5556D56350Ff2157B7c`
  created, funded, and granted on ProducerRegistry V2.
- [x] ProducerRegistry V2 deployed and all three legacy profiles migrated.
- [x] Canonical GrowFi EAS schema registered on Ethereum mainnet.
- [x] UGraph `latest` serves v5.3.2 with both registry data sources and no
  indexing errors.
- [x] DigitalOcean deployment `32431930-419a-4f78-b312-4224ab0bc044` first
  activated the mainnet chain/Registry V2, sponsored EAS relay, and public
  social UI configuration on commit `ca87507`; later deployments inherit the
  same remote spec.
- [x] The live challenge endpoint returns chain 1 and ProducerRegistry V2; an
  invalid wallet signature returns HTTP 401 before proof retrieval or gas use.
- [x] The first grower-authorized verification minted EAS UID
  `0x45b153753d331ad71d65077cf990a1ef4e9927969d781ce766fb6d35f207d594`;
  the identical UID, proof hash, handle, and URLs are live in ProducerRegistry
  V2 and the UGraph producer row.

Never create a replacement DigitalOcean app while the existing app ownership is
unresolved. That risks splitting production domains, secrets, and Spaces data
between two apps.

## Local secret handling

Store rollout secrets only in an ignored local file such as
`.env.mainnet.local`. Never pass a private key directly on the command line.

```dotenv
MAINNET_RPC_URL=https://...
MAINNET_DEPLOYER_PRIVATE_KEY=0x...
MAINNET_OWNER_ADDRESS=0xA229F3c9851E26fC9eA18157b88cd1CDA6F90e55
SOCIAL_VERIFIER_ADDRESS=0x...
```

Load it in the current shell:

```bash
set -a
source .env.mainnet.local
set +a
```

Verify identities without printing either private key:

```bash
cast wallet address --private-key "$MAINNET_DEPLOYER_PRIVATE_KEY"
cast chain-id --rpc-url "$MAINNET_RPC_URL"
cast balance "$MAINNET_OWNER_ADDRESS" --ether --rpc-url "$MAINNET_RPC_URL"
cast balance "$SOCIAL_VERIFIER_ADDRESS" --ether --rpc-url "$MAINNET_RPC_URL"
```

The first command must print `0xA229F3c9851E26fC9eA18157b88cd1CDA6F90e55`
and the chain id must be `1`.

## Phase 1 — final validation

```bash
forge fmt --check \
  src/GrowfiCampaignFactory.sol \
  src/GrowfiStakingVault.sol \
  src/GrowfiTreasury.sol \
  src/interfaces/IGrowfiStakingVaultMin.sol \
  src/modules/SaleClassicModule.sol \
  script/UpgradeMainnetSecurity20260710.s.sol \
  script/RegisterMainnetSocialEAS.s.sol \
  test/GrowfiIntegration.t.sol \
  test/Security.t.sol \
  test/SecurityFixes.t.sol \
  test/fork/MainnetSecurityUpgrade20260710Fork.t.sol

FOUNDRY_PROFILE=ci forge test --offline

RUN_MAINNET_FORK_TESTS=true \
MAINNET_RPC_URL="$MAINNET_RPC_URL" \
MAINNET_FORK_BLOCK=<pinned-block> \
forge test \
  --match-contract MainnetSecurityUpgrade20260710ForkTest \
  -vv

npm --prefix platform/backend test
npm --prefix platform/backend run build
npm --prefix platform/frontend run lint
npm --prefix platform/frontend run build
```

Run the exact rollout script as a non-broadcasting fork simulation:

```bash
FORK_SIMULATION=1 \
MAINNET_RPC_URL="$MAINNET_RPC_URL" \
forge script \
  script/UpgradeMainnetSecurity20260710.s.sol:UpgradeMainnetSecurity20260710 \
  --rpc-url "$MAINNET_RPC_URL" \
  -vvvv
```

Review every printed proxy, old implementation, new implementation, campaign
index, and migrated stake amount before continuing.

## Phase 2 — contract broadcast

**Status: completed successfully on 2026-07-10.** The 22 confirmed
transactions span blocks `25501399`-`25501432`. Current implementations are:

- Factory: `0xC591c1c9F3269368457f06540b7EAC06a8A8d269`
- Treasury: `0xAF3c5Bc33E57e0f37723a72B0D2cA1D1F7Ef3594`
- StakingVault: `0xe9a9D14227B1bBe6c41de8002098Ef14F4768CEa`
- SaleClassic: `0x3C5077c5eE8cB22886352f331D105d770693ec5D`

The complete transaction ledger, proxy/admin inventory, module state, and both
campaign stacks are recorded in `CONTRACTS.md` and
`deployments/mainnet.json`.

Broadcast only after Phase 1 passes against a pinned fork block:

```bash
forge script \
  script/UpgradeMainnetSecurity20260710.s.sol:UpgradeMainnetSecurity20260710 \
  --rpc-url "$MAINNET_RPC_URL" \
  --broadcast \
  --slow \
  -vvvv
```

The script performs the following sequence:

1. verifies owner, ProxyAdmin owners, and the exact campaign count;
2. upgrades the Factory;
3. pauses each Campaign, HarvestManager, and StakingVault;
4. snapshots each first-season vault's eligible stake;
5. upgrades Treasury and staking vault implementations;
6. initializes isolated season stake accounting;
7. replaces and registers SaleClassic for existing and future campaigns;
8. verifies preserved state and unpauses every subsystem.

If execution stops after one or more transactions, do not improvise individual
calls. Inspect the confirmed transaction list and rerun the same script. Its
preconditions and initialized-state checks are designed for partial completion.

After success, rerun the mainnet-fork preservation test at the first block after
the rollout and record every implementation address and transaction hash in
`CONTRACTS.md`.

## Phase 3 — replace ProducerRegistry and prepare EAS on mainnet

**Status: completed successfully on 2026-07-10.** ProducerRegistry V2 was
deployed at `0x267901bB08cb864b204D92185Fac8d6f9dee0F98` in block `25502657`.
All three legacy profiles were imported with their exact URI and version, the
dedicated backend verifier was granted in block `25502664`, and the canonical
GrowFi schema was registered in block `25502666` with UID
`0x78422879833ca667e9b3ea79d6aaa24328d751493bbd42c92d271d7e94f40caa`.
The complete transaction ledger is recorded in `CONTRACTS.md`.

The legacy ProducerRegistry does not expose any social-verifier selector and is
not upgradeable. The preparation script deploys `GrowfiProducerRegistryV2`,
imports the three currently indexed producer profiles directly from the fixed
legacy registry, grants the dedicated verifier, and registers the canonical
schema if it does not already exist. It does not publish a user attestation.

The mainnet subgraph was queried immediately before broadcast and returned
exactly the three migrated producer rows. Future legacy rows can still be
imported permissionlessly through `migrateLegacyProducer(address)`; migration
data is read from the fixed legacy contract and cannot be supplied by callers.

First simulate:

```bash
FORK_SIMULATION=1 \
MIN_SOCIAL_VERIFIER_BALANCE_WEI=0 \
forge script \
  script/RegisterMainnetSocialEAS.s.sol:RegisterMainnetSocialEAS \
  --rpc-url "$MAINNET_RPC_URL" \
  -vvvv
```

Then require the verifier to be funded and broadcast:

```bash
forge script \
  script/RegisterMainnetSocialEAS.s.sol:RegisterMainnetSocialEAS \
  --rpc-url "$MAINNET_RPC_URL" \
  --broadcast \
  --slow \
  -vvvv
```

The resumable broadcast artifact is stored under
`broadcast/RegisterMainnetSocialEAS.s.sol/1/`. Future dry runs must set
`MAINNET_PRODUCER_REGISTRY_V2_ADDRESS` to the deployed V2 address so they do not
create another registry.

The schema UID, migrated profile URIs and versions, V2 owner, fixed legacy
registry, and verifier grant were verified independently against two mainnet
RPC providers. Subgraph `5.3.2` retains the legacy source and adds the V2 source
at deploy block `25502657`; both write the same producer entity ids.

## Phase 4 — deploy the application with EAS disabled

**Status: completed.** The first V2-aware application deployment kept both EAS
publishing and the public social UI disabled while Registry V2 routing, UGraph,
and the hardened verification endpoints were checked independently.

Use a DigitalOcean context authenticated for the RIFAI team. Confirm the
existing production app before doing anything else:

```bash
doctl apps get 9e4019f4-8dbc-4170-8546-ce7d8579e3a4 \
  --context turinglabs \
  --format ID,Spec.Name,DefaultIngress
doctl apps spec validate .do/app.yaml
```

Fetch the live spec, preserve all existing encrypted secrets, patch it, and then
update the same app. Do not apply the repository spec directly over a live spec
that contains out-of-band secrets.

The first application deployment must use:

```dotenv
CHAIN_ID=1
PRODUCER_REGISTRY_ADDRESS=<PRODUCER_REGISTRY_V2_ADDRESS>
SOCIAL_EAS_ENABLED=false
SOCIAL_REGISTRY_RELAY=true
SOCIAL_CHALLENGES_OBJECT_PREFIX=social-challenges
SOCIAL_EAS_MAX_GAS_PRICE_WEI=50000000000
NEXT_PUBLIC_ENABLE_SOCIAL_VERIFICATION=false
```

The frontend build must also use
`NEXT_PUBLIC_PRODUCER_REGISTRY_ADDRESS=<PRODUCER_REGISTRY_V2_ADDRESS>` even
while its social feature flag remains false.

It must also include fresh secret values for:

- `SOCIAL_CHALLENGE_SECRET`;
- `SOCIAL_VERIFIER_PRIVATE_KEY`;
- `SOCIAL_RPC_URL` or `SOCIAL_RPC_URLS`;
- the existing Spaces credentials and unrelated production secrets.

Confirm health, logs, Merkle publication authorization, SSRF rejection, and
challenge signature validation while no sponsored EAS transaction can be sent.

## Phase 5 — enable EAS, then the public UI

**Status: enabled in production on 2026-07-10.** DigitalOcean deployment
`32431930-419a-4f78-b312-4224ab0bc044` first activated the configuration on
commit `ca87507`; later deployments inherit the same remote spec. The spec
explicitly uses chain 1, ProducerRegistry V2, canonical mainnet EAS and
SchemaRegistry addresses, encrypted challenge/verifier secrets,
`SOCIAL_EAS_ENABLED=true`, and
`NEXT_PUBLIC_ENABLE_SOCIAL_VERIFICATION=true`.

Runtime smoke checks returned a campaign-bound website challenge with chain 1
and Registry V2, and rejected an intentionally invalid EIP-191 signature with
HTTP 401 before proof retrieval or any sponsored transaction. The public bundle
queries the v5.3.2 social fields.

The first valid X verification published EAS UID
`0x45b153753d331ad71d65077cf990a1ef4e9927969d781ce766fb6d35f207d594`
in transaction
`0xa9bec33d321162416409b642453721ae6ad12f7547a0eefecde5178e5037ad00`
at block `25503273`. A rolling App Platform deployment replaced the backend
instance before the Registry relay completed. The already-published EAS data
was decoded and checked against the grower, post URL, proof hash, expiry, and
nonce; the same UID was then reconciled into ProducerRegistry V2 in transaction
`0x65ceea57bbe4c422abc3623d005640f0a8f4de93e2b51292824bcce984048c00`
at block `25503310`, without creating a duplicate EAS attestation. UGraph
indexed the row at that block and the public grower profile renders the on-chain
verified badge and social link.

Enable `SOCIAL_EAS_ENABLED=true` while keeping
`NEXT_PUBLIC_ENABLE_SOCIAL_VERIFICATION=false`. Run one controlled verification
for a producer wallet that owns the submitted campaign. Confirm:

- one EAS attestation with the canonical schema;
- one ProducerRegistry `setSocialAttestation` transaction;
- the same non-zero EAS UID in both systems;
- one atomic challenge reservation in Spaces;
- a replay returns HTTP 409 and sends no transaction;
- requests above the configured gas-price ceiling fail closed.

Only after this succeeds, rebuild the frontend with
`NEXT_PUBLIC_ENABLE_SOCIAL_VERIFICATION=true` and verify the indexed social
fields on the public grower page.

## Recovery and rollback

- The security script pauses all campaign subsystems before storage migration.
  If a post-upgrade invariant fails, leave them paused and investigate before
  any manual unpause.
- Preserve the old implementation addresses emitted by the script. Proxy
  rollback must use the same ProxyAdmin owner EOA and must account for the new
  appended staking-vault state before downgrading.
- Keep `SOCIAL_EAS_ENABLED=false` as the application kill switch for sponsored
  transactions. Keep `NEXT_PUBLIC_ENABLE_SOCIAL_VERIFICATION=false` as the
  independent UI kill switch.
- If EAS succeeds but the ProducerRegistry relay fails, the challenge remains
  consumed to prevent a duplicate paid attestation. Reconcile that UID manually
  before allowing another verification for the wallet.
