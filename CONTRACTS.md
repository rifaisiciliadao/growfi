# GrowFi — Deployments

## Base Sepolia (chain 84532)

**Deployed:** 2026-04-28 (v3.1 — single $50k campaign with collateral) · **Deployer/owner:** `0xFF6bdef4fB646EE44e29FE8FC0862B02F0Ba8a33`

> Second fresh redeploy on the same day. Ships the v3 mechanic with a
> single seeded test campaign sized to the spec the user asked for: $50,400
> max raise (350k OLIVE × $0.144) committing 10%/yr → $5,040/yr at full
> raise, with $15,000 USDC of collateral pre-funding the first 3 harvests.
> The previous v3 deploy at `0x91fD…6BDD` is abandoned along with its two
> orphaned test campaigns (`0xcB4Eb2…F6b8b` and `0x66aa3c…5063D`).
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
| **CampaignFactory** (proxy) | [`0xDE26BD22B4dC048B57ab258347d0000F5641bF9f`](https://sepolia.basescan.org/address/0xDE26BD22B4dC048B57ab258347d0000F5641bF9f) | v3 — permissionless campaign creation. Deploy block `40798870`. |
| **CampaignRegistry** | [`0x73910DCC8E41E5480C43C902e26a2e24B4a26b97`](https://sepolia.basescan.org/address/0x73910DCC8E41E5480C43C902e26a2e24B4a26b97) | Onchain map `campaign → metadataURI` + monotonic `version`. Deploy block `40798883`. |
| **ProducerRegistry** | [`0x4921f38F3D0de21057Ef202629D501E8b99d8616`](https://sepolia.basescan.org/address/0x4921f38F3D0de21057Ef202629D501E8b99d8616) | v3 — owner-controlled KYC role + producer-self-served profile. Deploy block `40798889`. |
| **MockUSDC** | [`0x12a159519C63A1844710Bb1aB85a41E8a58C1aAA`](https://sepolia.basescan.org/address/0x12a159519C63A1844710Bb1aB85a41E8a58C1aAA) | 6-dec testnet USDC. Public `mint(to, amount)`. Pre-v3.1 mUSDCs abandoned. |

### Test campaign (single)

| Field | Value |
|---|---|
| Campaign proxy | [`0x1a96BFcF98a7d2f8d84433e568F30B37aC6600F7`](https://sepolia.basescan.org/address/0x1a96BFcF98a7d2f8d84433e568F30B37aC6600F7) |
| pricePerToken | $0.144 |
| minCap | 100,000 OLIVE ($14,400) |
| maxCap | 350,000 OLIVE ($50,400) |
| expectedYearlyReturnBps | 1000 (10%/yr → $5,040/yr at full raise) |
| expectedFirstYearHarvest | 35,000 liters of olive oil |
| coverageHarvests | 3 |
| collateralLocked | $15,000 USDC |
| Initial state | Active, season 1 running (Alice+Bob staked) |

### Implementations (used for each new campaign's proxies)

| Contract | Address |
|---|---|
| Campaign impl (v3) | [`0xed255eC04030bCe9F676E920D6273Df2008c9f86`](https://sepolia.basescan.org/address/0xed255eC04030bCe9F676E920D6273Df2008c9f86) |
| CampaignToken impl | [`0x0Ffb5a809f720F90EbCe4f8D12b448E9FF6f3e78`](https://sepolia.basescan.org/address/0x0Ffb5a809f720F90EbCe4f8D12b448E9FF6f3e78) |
| StakingVault impl | [`0xFED3CB7218072A086827B99aE2566A23C2F1EA78`](https://sepolia.basescan.org/address/0xFED3CB7218072A086827B99aE2566A23C2F1EA78) |
| YieldToken impl | [`0xeEF4Ee09B95C815Add284CafD34417B26693C099`](https://sepolia.basescan.org/address/0xeEF4Ee09B95C815Add284CafD34417B26693C099) |
| HarvestManager impl (v3 — depositFromCollateral) | [`0xF12c69fe8C4C5Ae52AaE471F55184d8D74e8A8D4`](https://sepolia.basescan.org/address/0xF12c69fe8C4C5Ae52AaE471F55184d8D74e8A8D4) |
| Factory impl (v3) | [`0x3df6E29D17F28fF2759cf2D770C4Ec008E880aa3`](https://sepolia.basescan.org/address/0x3df6E29D17F28fF2759cf2D770C4Ec008E880aa3) |

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
