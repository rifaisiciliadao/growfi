# GrowFi — Deployments

## Base Sepolia (chain 84532)

**Deployed:** 2026-04-28 (v3.3 fresh demo redeploy) · **Deployer/owner:** `0xFF6bdef4fB646EE44e29FE8FC0862B02F0Ba8a33`

> Fresh full redeploy of every contract for a clean demo platform —
> factory + 5 impls + mUSDC mock + 2 registries from a single forge
> session. The deployer/owner has been granted `KYC_ADMIN_ROLE` on the
> ProducerRegistry and KYC-flagged the seed producer (Alice = deployer).
>
> Single seeded test campaign on the new factory at
> `0x97bf2400d8C6D6e2C32Fa0Bb2C87269b62D677d2`: $50,400 max raise,
> $5,000/yr commitment from year 2030, 3 harvests covered by $15,000
> USDC of collateral; Alice + Bob both staked, season 1 running.
>
> Subgraph: tag `prod` now points at `growfi/2.8.0`, indexed from the
> new factory deploy block.
>
> Earlier deploys abandoned: `0xD5C6…79D` (v3.3 first), `0x91fD…6BDD`
> (v3.0), `0xDE26…bF9f` (v3.1), `0x5178…FF64` (pre-v3).
>
> All v3 mechanics carry forward unchanged: `expectedAnnualHarvestUsd`,
> `expectedAnnualHarvest`, `firstHarvestYear`, `coverageHarvests`
> immutable per-campaign; `Campaign.lockCollateral` (cumulative, no
> withdraw); permissionless `Campaign.settleSeasonShortfall(seasonId)`
> after `usdcDeadline` lapses, wired to
> `HarvestManager.depositFromCollateral` for the holder-side top-up;
> ProducerRegistry KYC role gated to `KYC_ADMIN_ROLE` admins set by the
> registry's 2-step owner.
>
> Funding fee 3% (`Campaign.buy` skim) and harvest fee 2%
> (`HarvestManager.depositUSDC`) unchanged.

### Entry points (user-facing)

| Contract | Address | Purpose |
|---|---|---|
| **CampaignFactory** (proxy) | [`0x73d677db3425edee764bf47c66dbb15217eefff6`](https://sepolia.basescan.org/address/0x73d677db3425edee764bf47c66dbb15217eefff6) | v3.3 — permissionless campaign creation. Deploy block `40811661`. |
| **CampaignRegistry** | [`0x49FEe690091F5FC0F5317d9bB7975d8bcB4A8ACb`](https://sepolia.basescan.org/address/0x49FEe690091F5FC0F5317d9bB7975d8bcB4A8ACb) | Onchain map `campaign → metadataURI` + monotonic `version`. Deploy block `40811721`. |
| **ProducerRegistry** | [`0x23e28Cbf86861D6f6f61f067c2A39f5f8f0d9fd2`](https://sepolia.basescan.org/address/0x23e28Cbf86861D6f6f61f067c2A39f5f8f0d9fd2) | v3 — owner-controlled KYC role + producer-self-served profile. Deploy block `40811739`. |
| **MockUSDC** | [`0xA07e3dbB5Bc40f11723213E3A236B408b862C1ff`](https://sepolia.basescan.org/address/0xA07e3dbB5Bc40f11723213E3A236B408b862C1ff) | 6-dec testnet USDC. Public `mint(to, amount)`. Pre-v3.3-redeploy mUSDCs abandoned. |

### Test campaign (single)

| Field | Value |
|---|---|
| Campaign proxy | [`0x97bf2400d8C6D6e2C32Fa0Bb2C87269b62D677d2`](https://sepolia.basescan.org/address/0x97bf2400d8C6D6e2C32Fa0Bb2C87269b62D677d2) |
| Producer (KYC ✓) | `0xFF6bdef4fB646EE44e29FE8FC0862B02F0Ba8a33` (alice) |
| pricePerToken | $0.144 |
| minCap | 100,000 OLIVE ($14,400) |
| maxCap | 350,000 OLIVE ($50,400) |
| expectedAnnualHarvestUsd | $5,000/yr (≈ 9.92% implied yield at full raise) |
| expectedAnnualHarvest | 250 L/yr (premium olive oil → implied ≈ $20/L) |
| firstHarvestYear | 2030 |
| coverageHarvests | 3 (covers 2030–2032) |
| collateralLocked | $15,000 USDC |
| Initial state | Active, season 1 running (Alice+Bob staked) |

### Implementations (used for each new campaign's proxies)

| Contract | Address |
|---|---|
| Campaign impl (v3.3) | [`0x2cc441de7f38c34057b822dc486f3dd9061fea73`](https://sepolia.basescan.org/address/0x2cc441de7f38c34057b822dc486f3dd9061fea73) |
| CampaignToken impl | [`0x96ee1b53a5489fc2e5f3fa31cd74a295ccbf1457`](https://sepolia.basescan.org/address/0x96ee1b53a5489fc2e5f3fa31cd74a295ccbf1457) |
| StakingVault impl | [`0x274a2f81cd09063fe63b5e748f0c0d345d058169`](https://sepolia.basescan.org/address/0x274a2f81cd09063fe63b5e748f0c0d345d058169) |
| YieldToken impl | [`0xccd1ff1748e3873b0e56b5cceb67f0e0b7f69f87`](https://sepolia.basescan.org/address/0xccd1ff1748e3873b0e56b5cceb67f0e0b7f69f87) |
| HarvestManager impl (v3 — depositFromCollateral) | [`0x5ed362a99bd45db191e9b03ec7c696310db8c602`](https://sepolia.basescan.org/address/0x5ed362a99bd45db191e9b03ec7c696310db8c602) |
| Factory impl (v3.3) | [`0x3c1ea6edd6c5667fbed45cc5ddf70d42cf4251b8`](https://sepolia.basescan.org/address/0x3c1ea6edd6c5667fbed45cc5ddf70d42cf4251b8) |

Prior Campaign/Factory impls (archived, on the abandoned 0x5178…FF64 factory):
- Campaign v2 (3% funding fee): `0xfb80BC2bCEd8cc7a97C5DD52e718981ef647ECa2`
- Campaign v1 (sell-back @ maxCap + setters): `0xD523683685D1e4d93A0Aa7d077a47F56848bc0D8`
- Factory v2: `0x3Fc470071F1e5DE4571BcaB46501416A8a2B89eD`
- Factory v1: `0xad06176c9BC2fc9B78e4500937B4779Efe03f06c`

### Configuration

| Parameter | Value |
|---|---|
| Factory owner | `0xFF6bdef4fB646EE44e29FE8FC0862B02F0Ba8a33` |
| Protocol fee recipient | `0xFF6bdef4fB646EE44e29FE8FC0862B02F0Ba8a33` |
| Funding-side fee (bps) | 300 (= 3% skimmed off every `buy()` gross inflow, non-refundable on buyback) |
| Yield-side fee (bps) | 200 (= 2% skimmed off every `HarvestManager.depositUSDC`) |
| Sequencer uptime feed | `0x0000…0000` (testnet, no sequencer guard) |
| USDC | MockUSDC (see above) |
| `minSeasonDuration` | 1 hour (relaxed from 30 days for testnet smokes) |

> Lower the floor for fast testnet smokes: `cast send <FACTORY> "setMinSeasonDuration(uint256)" 3600 --rpc-url ... --private-key $OWNER_PK`.

### 2-step USDC redeem

HarvestManager implements the commit/deposit/claim split:

| Step | Function | Event |
|---|---|---|
| 1. commit | `redeemUSDC(seasonId, yieldAmount)` — burns $YIELD, registers pending claim | `USDCCommitted(user, seasonId, yieldBurned, usdcAmount)` |
| 2. fund | `depositUSDC(seasonId, amount)` — producer tops up the pool (98/2 split) | `USDCDeposited` |
| 3. claim | `claimUSDC(seasonId)` — holder pulls pro-rata USDC | `USDCRedeemed(user, seasonId, amount)` |

Full UX spec in `docs/REDEEM_2STEP.md`.

---

## Subgraph

- Version `2.8.0` (tagged `prod`)
- Deployed: 2026-04-28
- API: `https://api.goldsky.com/api/public/project_cmo1ydnmbj6tv01uwahhbeenr/subgraphs/growfi/prod/gn`
- Pin version: replace `prod` with `2.8.0` (useful during schema migrations so an older frontend can stick to a previous version).

---

## Frontend `.env.local`

```bash
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_FACTORY_ADDRESS=0x73d677db3425edee764bf47c66dbb15217eefff6
NEXT_PUBLIC_USDC_ADDRESS=0xA07e3dbB5Bc40f11723213E3A236B408b862C1ff
NEXT_PUBLIC_REGISTRY_ADDRESS=0x49FEe690091F5FC0F5317d9bB7975d8bcB4A8ACb
NEXT_PUBLIC_PRODUCER_REGISTRY_ADDRESS=0x23e28Cbf86861D6f6f61f067c2A39f5f8f0d9fd2
NEXT_PUBLIC_SUBGRAPH_URL=https://api.goldsky.com/api/public/project_cmo1ydnmbj6tv01uwahhbeenr/subgraphs/growfi/prod/gn
NEXT_PUBLIC_BACKEND_URL=http://localhost:4001
```

> **EIP-55 gotcha**: viem's address validator rejects mixed-case strings that aren't valid EIP-55 checksums. Run `cast to-check-sum-address 0x...` after any new deploy. The addresses above are already in the correct checksum form.

---

## Quick interactions

### Get test USDC (anyone)

```bash
cast send 0xA07e3dbB5Bc40f11723213E3A236B408b862C1ff \
  "mint(address,uint256)" <YOUR_ADDRESS> 10000000000 \
  --rpc-url https://sepolia.base.org --private-key $YOUR_PK
# → 10,000 mUSDC (6 decimals)
```

### Read factory state

```bash
cast call 0x73d677db3425edee764bf47c66dbb15217eefff6 \
  "getCampaignCount()(uint256)" --rpc-url https://sepolia.base.org
```

### Create a campaign (as producer)

Use the frontend at `/create`, or raw call:

```bash
cast send 0x73d677db3425edee764bf47c66dbb15217eefff6 \
  "createCampaign((address,string,string,string,string,uint256,uint256,uint256,uint256,uint256,uint256))" \
  "(<YOUR_ADDRESS>,Olive Tree,OLIVE,Olive Yield,oYIELD,144000000000000000,10000000000000000000000,100000000000000000000000,$(( $(date +%s) + 7776000 )),15552000,5000000000000000000)" \
  --rpc-url https://sepolia.base.org --private-key $YOUR_PK
# price 0.144 USD, minCap 10k, maxCap 100k, deadline +90d, season 180d, minProductClaim 5e18
```

### Set/update producer profile (any address)

```bash
cast send 0x23e28Cbf86861D6f6f61f067c2A39f5f8f0d9fd2 \
  "setProfile(string)" \
  "https://growfi-media.fra1.digitaloceanspaces.com/profiles/<cid>.json" \
  --rpc-url https://sepolia.base.org --private-key $YOUR_PK
```

### Set/update campaign metadata URI (as producer)

```bash
cast send 0x49FEe690091F5FC0F5317d9bB7975d8bcB4A8ACb \
  "setMetadata(address,string)" \
  <CAMPAIGN_PROXY_ADDRESS> "https://growfi-media.fra1.digitaloceanspaces.com/metadata/<cid>.json" \
  --rpc-url https://sepolia.base.org --private-key $YOUR_PK
```

---

## Backend endpoints (port 4001)

| Endpoint | Purpose |
|---|---|
| `POST /api/upload` | multipart image → DO Spaces |
| `POST /api/metadata` | campaign metadata JSON → DO Spaces |
| `POST /api/producer` | producer profile JSON → DO Spaces |
| `GET /api/snapshot/:campaign/:seasonId` | per-holder $YIELD snapshot for the reportHarvest flow |
| `POST /api/merkle/generate` | builds + stores the Merkle tree; returns `{ root, url, count }` |
| `GET /api/merkle/:campaign/:seasonId/:user` | returns `{ user, productAmount, proof }` for product redemption |

---

## Reset / redeploy

```bash
source .env
forge script script/DeployTestnet.s.sol \
  --rpc-url https://sepolia.base.org \
  --broadcast --slow --private-key $PRIVATE_KEY
FACTORY=<new factory proxy> forge script script/DeployRegistry.s.sol \
  --rpc-url https://sepolia.base.org --broadcast --private-key $PRIVATE_KEY
forge script script/DeployProducerRegistry.s.sol \
  --rpc-url https://sepolia.base.org --broadcast --private-key $PRIVATE_KEY
```

After deploying, bump `platform/subgraph/package.json` version, update `platform/subgraph/subgraph.yaml` addresses + startBlocks, then:

```bash
cd platform/subgraph
for n in Campaign CampaignFactory CampaignToken CampaignRegistry HarvestManager ProducerRegistry StakingVault YieldToken; do
  jq '.abi' ../../out/$n.sol/$n.json > abis/$n.json
done
npm run prepare
npm run deploy:goldsky:prod
```

Update `platform/frontend/.env.local` + `src/contracts/tokens.ts` (KNOWN_TOKENS mUSDC address) + re-extract ABIs to `src/contracts/abis/`.
