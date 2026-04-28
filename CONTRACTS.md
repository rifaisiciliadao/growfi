# GrowFi — Deployments

## Base Sepolia (chain 84532)

**Deployed:** 2026-04-28 (v3.3 — annualHarvest USD + product qty) · **Deployer/owner:** `0xFF6bdef4fB646EE44e29FE8FC0862B02F0Ba8a33`

> Third fresh redeploy. Replaces the bps-based commitment with two explicit
> producer fields:
> - `expectedAnnualHarvestUsd` — absolute USD commitment per year (e.g.
>   $5,000/yr). Different products = different unit prices, so deriving
>   from the funding side alone wasn't accurate; the producer commits the
>   exact value.
> - `firstHarvestYear` — calendar year of harvest 1 (e.g. 2030). Year
>   counters in the UI (Year 1 → 2030, payback ends in 2039, etc.) start
>   from this anchor.
>
> The implied bps + payback horizon are derived in the UI from
> `expectedAnnualHarvestUsd / (maxCap × pricePerToken)`. The /create form
> shows a Feasibility summary live so the producer sees "asking $50k that
> returns $5k/yr → 10 years to payback" before deploying.
>
> Single seeded test campaign at `0x8714B91…86F7B`: $50,400 max raise,
> $5,000/yr commitment from year 2030, 3 harvests covered by $15,000
> USDC of collateral.
>
> Earlier deploys abandoned: `0x91fD…6BDD` (v3.0), `0xDE26…bF9f` (v3.1),
> and `0x5178…FF64` (pre-v3).
>
> All v3 mechanics carry forward unchanged: `expectedYearlyReturnBps`,
> `expectedFirstYearHarvest`, `coverageHarvests` immutable per-campaign;
> `Campaign.lockCollateral` (cumulative, no withdraw); permissionless
> `Campaign.settleSeasonShortfall(seasonId)` after `usdcDeadline` lapses,
> wired to `HarvestManager.depositFromCollateral` for the holder-side
> top-up; ProducerRegistry KYC role gated to `KYC_ADMIN_ROLE` admins set
> by the registry's 2-step owner.
>
> Funding fee 3% (`Campaign.buy` skim) and harvest fee 2%
> (`HarvestManager.depositUSDC`) unchanged.
>
> Prior layers (now archived under abandoned factories): sell-back at
> maxCap fix + producer setters (2026-04-20), funding fee + non-refundable
> on buyback (2026-04-23), v3 yearly return + collateral + KYC (earlier
> 2026-04-28). Regression suites: `test/SellBackAtMaxCap.t.sol`,
> `test/ParamUpdates.t.sol`, `test/CollateralAttacks.t.sol`,
> `test/CollateralHardening.t.sol`, `test/ProducerRegistryKyc.t.sol`.

### Entry points (user-facing)

| Contract | Address | Purpose |
|---|---|---|
| **CampaignFactory** (proxy) | [`0xD5C6705c291743BBd9b30B08680360f96801579D`](https://sepolia.basescan.org/address/0xD5C6705c291743BBd9b30B08680360f96801579D) | v3.3 — permissionless campaign creation. Deploy block `40804000`. |
| **CampaignRegistry** | [`0xbe1ce60CE358a70603a494dcb271A505D3C1f988`](https://sepolia.basescan.org/address/0xbe1ce60CE358a70603a494dcb271A505D3C1f988) | Onchain map `campaign → metadataURI` + monotonic `version`. Deploy block `40804124`. |
| **ProducerRegistry** | [`0x9b41c56Cddb0d9DC6c97d8d4c5246e6d4caC329e`](https://sepolia.basescan.org/address/0x9b41c56Cddb0d9DC6c97d8d4c5246e6d4caC329e) | v3 — owner-controlled KYC role + producer-self-served profile. Deploy block `40804129`. |
| **MockUSDC** | [`0x4E53CF93D2927D225668EE570Dc3fA8b55917130`](https://sepolia.basescan.org/address/0x4E53CF93D2927D225668EE570Dc3fA8b55917130) | 6-dec testnet USDC. Public `mint(to, amount)`. Pre-v3.3 mUSDCs abandoned. |

### Test campaign (single)

| Field | Value |
|---|---|
| Campaign proxy | [`0xa97Bf4E0098B1af9509d626e1946EbD8769274Ab`](https://sepolia.basescan.org/address/0xa97Bf4E0098B1af9509d626e1946EbD8769274Ab) |
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
| Campaign impl (v3.3) | [`0xBDB6162d6027085191D6D883c745FbADF176aa5F`](https://sepolia.basescan.org/address/0xBDB6162d6027085191D6D883c745FbADF176aa5F) |
| CampaignToken impl | [`0x7554BBc5F6bdA2134dFb3175BB0F8D9fe512Dc6c`](https://sepolia.basescan.org/address/0x7554BBc5F6bdA2134dFb3175BB0F8D9fe512Dc6c) |
| StakingVault impl | [`0x5f0C6aB3BE2Ab2A437468A849ba69ee00aC17039`](https://sepolia.basescan.org/address/0x5f0C6aB3BE2Ab2A437468A849ba69ee00aC17039) |
| YieldToken impl | [`0x4710Fda8f249efd52258dadEBC2aFC7f0d56F796`](https://sepolia.basescan.org/address/0x4710Fda8f249efd52258dadEBC2aFC7f0d56F796) |
| HarvestManager impl (v3 — depositFromCollateral) | [`0x31d06CBdA2cad0255542f022f215446089F4142e`](https://sepolia.basescan.org/address/0x31d06CBdA2cad0255542f022f215446089F4142e) |
| Factory impl (v3.3) | [`0x92b8f7256F6f0fDCCC930f9d5bf38506A1fEE16e`](https://sepolia.basescan.org/address/0x92b8f7256F6f0fDCCC930f9d5bf38506A1fEE16e) |

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

- Version `2.1.0` (tagged `prod`)
- Deployed: 2026-04-20
- API: `https://api.goldsky.com/api/public/project_cmo1ydnmbj6tv01uwahhbeenr/subgraphs/growfi/prod/gn`
- Pin version: replace `prod` with `2.1.0` (useful during schema migrations so an older frontend can stick to a previous version).

---

## Frontend `.env.local`

```bash
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_FACTORY_ADDRESS=0x5178A4AB4c6400CeeB812663AFfd1bd5B0c9FF64
NEXT_PUBLIC_USDC_ADDRESS=0x1b0a76431b3CfD55b3be22497F03920C71623c47
NEXT_PUBLIC_REGISTRY_ADDRESS=0x6cfC4b78131947721A2370B594Ed81BD758a1e17
NEXT_PUBLIC_PRODUCER_REGISTRY_ADDRESS=0x2bbc8FE2626C7f83fDe22E4799E76B93Cc8b379e
NEXT_PUBLIC_SUBGRAPH_URL=https://api.goldsky.com/api/public/project_cmo1ydnmbj6tv01uwahhbeenr/subgraphs/growfi/prod/gn
NEXT_PUBLIC_BACKEND_URL=http://localhost:4001
```

> **EIP-55 gotcha**: viem's address validator rejects mixed-case strings that aren't valid EIP-55 checksums. Run `cast to-check-sum-address 0x...` after any new deploy. The addresses above are already in the correct checksum form.

---

## Quick interactions

### Get test USDC (anyone)

```bash
cast send 0x1b0a76431b3CfD55b3be22497F03920C71623c47 \
  "mint(address,uint256)" <YOUR_ADDRESS> 10000000000 \
  --rpc-url https://sepolia.base.org --private-key $YOUR_PK
# → 10,000 mUSDC (6 decimals)
```

### Read factory state

```bash
cast call 0x5178A4AB4c6400CeeB812663AFfd1bd5B0c9FF64 \
  "getCampaignCount()(uint256)" --rpc-url https://sepolia.base.org
```

### Create a campaign (as producer)

Use the frontend at `/create`, or raw call:

```bash
cast send 0x5178A4AB4c6400CeeB812663AFfd1bd5B0c9FF64 \
  "createCampaign((address,string,string,string,string,uint256,uint256,uint256,uint256,uint256,uint256))" \
  "(<YOUR_ADDRESS>,Olive Tree,OLIVE,Olive Yield,oYIELD,144000000000000000,10000000000000000000000,100000000000000000000000,$(( $(date +%s) + 7776000 )),15552000,5000000000000000000)" \
  --rpc-url https://sepolia.base.org --private-key $YOUR_PK
# price 0.144 USD, minCap 10k, maxCap 100k, deadline +90d, season 180d, minProductClaim 5e18
```

### Set/update producer profile (any address)

```bash
cast send 0x2bbc8FE2626C7f83fDe22E4799E76B93Cc8b379e \
  "setProfile(string)" \
  "https://growfi-media.fra1.digitaloceanspaces.com/profiles/<cid>.json" \
  --rpc-url https://sepolia.base.org --private-key $YOUR_PK
```

### Set/update campaign metadata URI (as producer)

```bash
cast send 0x6cfC4b78131947721A2370B594Ed81BD758a1e17 \
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
