# GrowFi Subgraph — Goldsky Deploy

**Team:** turinglabs · **Project:** growfi · **Network:** sepolia

## Indexed Deployment

| Parameter | Value |
|-----------|--------|
| Chain | Ethereum Sepolia (id 11155111) |
| Factory | [`0xB804de4d151E5A8a9EBa61a9904EC3588c8EFb56`](https://sepolia.etherscan.io/address/0xB804de4d151E5A8a9EBa61a9904EC3588c8EFb56) |
| Start block | `10845295` |

Already configured in `subgraph.yaml`. See root `CONTRACTS.md` for the full address set.

---

## 1. Install And Login

```bash
cd platform/subgraph
npm install
npm run goldsky:login
```

API keys are available at https://app.goldsky.com -> Settings -> API Keys.

---

## 2. Build And Deploy

```bash
npm run prepare            # codegen + build in build/
npm run deploy:goldsky
```

This publishes `growfi/<package.json version>`. Do not tag or promote `prod` unless explicitly requested. The 2026-05-17 cleanup removed legacy versions and the stale `prod` tag; production uses the pinned version endpoint.

After deploy, save the pinned endpoint in the frontend/backend environment:

```
NEXT_PUBLIC_SUBGRAPH_URL=https://api.goldsky.com/api/public/<PROJECT_ID>/subgraphs/growfi/<VERSION>/gn
SUBGRAPH_URL=https://api.goldsky.com/api/public/<PROJECT_ID>/subgraphs/growfi/<VERSION>/gn
```

---

## 3. Deploying A New Version

1. Bump `version` in `package.json` using semver.
2. `npm run prepare && npm run deploy:goldsky`
3. Update app envs to the new pinned endpoint.

Goldsky can retain multiple versions for rollback, but this project currently keeps only the live pinned version to avoid stale indexes.

---

## 4. Logs And Debugging

```bash
npm run goldsky:logs
npm run goldsky:list
```

---

## Common Issues

| Symptom | Check |
|---------|------------------|
| `401 Unauthorized` | Re-run `goldsky login` |
| `Subgraph name already taken` | Bump `version` in `package.json` |
| Indexer stuck at start block | Verify the factory emits events by creating a campaign |
| Handler overflow / crash | Read `npm run goldsky:logs`, then run `npm run codegen` after ABI changes |
| Breaking schema change | Bump **minor** in semver |

---

## Teardown

```bash
npm run goldsky:delete    # Deletes the current package.json version
```

## v4 — GROW system + rename

The v4 redeploy adds:

1. **Renamed contracts** (Growfi prefix on all 8). ABIs are re-extracted; existing handler files (campaign.ts, factory.ts, ...) still reference the old aliases (CampaignFactory etc.) but the underlying ABI JSON content is up to date so codegen produces the right types.

2. **GROW system** (4 new contracts):
   - GrowfiToken (`./src/grow/token.ts`) — Transfer, DirectBuy, GenesisMinted, sale config events
   - GrowfiTreasury (`./src/grow/treasury.ts`) — StablecoinAccepted/Revoked, CampaignTracked/Untracked, Allocated, Redeemed, TokenRescued
   - GrowfiMinter (`./src/grow/minter.ts`) — CampaignRegistered, GrowEscrowed, GrowMinted, SoftCapReached, CampaignBuyback, EscrowClaimed, BondingCurveUpdated
   - GrowfiFeeSplitter (`./src/grow/splitter.ts`) — Flushed

3. **New entities** in `schema.graphql`: GrowToken, GrowHolder, GrowDirectBuy, GrowEscrow, GrowEscrowClaim, CampaignGrowState, BondingCurveSnapshot, GrowfiTreasuryState, StablecoinAcceptance, TreasuryAllocation, TreasuryRedemption, TreasuryRescue, FeeFlush.

### Post-deploy steps for v4

After running the v4 deploy script:

1. Replace the four `0x0000...0000` placeholder addresses in `subgraph.yaml` (the `GrowfiToken`, `GrowfiTreasury`, `GrowfiMinter`, `GrowfiFeeSplitter` data sources) with the actual proxy addresses.
2. Replace each `startBlock: 0` in those four sources with the deploy block.
3. Update the existing data sources (CampaignFactory, CampaignRegistry, ProducerRegistry, plus the dynamic templates) with their new v4 addresses + start blocks. The ABIs are already re-extracted as `Growfi*.json`.
4. Optionally rename the abi `name` aliases in `subgraph.yaml` from `Campaign` → `GrowfiCampaign` etc. for clarity, and update handler imports accordingly. (Not strictly required — the subgraph runs on event signatures, not contract names.)
5. Run:
   ```bash
   npm run prepare
   npm run deploy:goldsky:prod
   ```
6. Verify on Goldsky that all data sources index from the new start blocks.
