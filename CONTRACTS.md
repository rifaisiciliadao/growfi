# GrowFi — Deployments

## Base Sepolia (chain 84532)

**Deployed:** 2026-04-28 (v3 — yearly return + collateral + KYC) · **Deployer/owner:** `0xFF6bdef4fB646EE44e29FE8FC0862B02F0Ba8a33`

> Fresh redeploy that ships the v3 mechanic in full: every new campaign
> carries `expectedYearlyReturnBps`, `expectedFirstYearHarvest`, and
> `coverageHarvests` as immutable commitments; producer can lock USDC
> collateral that auto-covers holder shortfalls for the first
> `coverageHarvests` seasons (`Campaign.lockCollateral`,
> `Campaign.settleSeasonShortfall` permissionless after `usdcDeadline`,
> wired to `HarvestManager.depositFromCollateral`). The pre-v3 deploy at
> `0x5178A4AB4…FF64` is abandoned (orphaned campaigns stay there but the
> frontend + subgraph + DO config now point at the v3 set below).
>
> The 3% funding fee at `buy()` and the 2% harvest fee at
> `HarvestManager.depositUSDC` are unchanged (v2 carries forward).
>
> `ProducerRegistry` is also a fresh deploy — its constructor now takes
> an owner (2-step Ownable) who can grant/revoke the `KYC_ADMIN_ROLE`
> set. Producers cannot self-attest KYC.
>
> Prior layers (still relevant for the abandoned v2 deploy): sell-back
> at maxCap fix + producer setters (2026-04-20), funding fee + non-
> refundable on buyback (2026-04-23). Regression suites live in
> `test/SellBackAtMaxCap.t.sol`, `test/ParamUpdates.t.sol`,
> `test/CollateralAttacks.t.sol`, `test/ProducerRegistryKyc.t.sol`.

### Entry points (user-facing)

| Contract | Address | Purpose |
|---|---|---|
| **CampaignFactory** (proxy) | [`0x91fD5C9D274C519a152Af14223BD10Ed0b446BDD`](https://sepolia.basescan.org/address/0x91fD5C9D274C519a152Af14223BD10Ed0b446BDD) | v3 — permissionless campaign creation. `createCampaign(params)` now also takes `expectedYearlyReturnBps / expectedFirstYearHarvest / coverageHarvests`. Deploy block `40795602`. |
| **CampaignRegistry** | [`0x45AB8513a042f3C3A6A0E02f3641b10C6bd05eE8`](https://sepolia.basescan.org/address/0x45AB8513a042f3C3A6A0E02f3641b10C6bd05eE8) | Onchain map `campaign → metadataURI` + monotonic `version`. Bound to the v3 factory. Deploy block `40795624`. |
| **ProducerRegistry** | [`0x4910C1580C30Eb1c6C12C2136f3eA598c55d77C2`](https://sepolia.basescan.org/address/0x4910C1580C30Eb1c6C12C2136f3eA598c55d77C2) | v3 — owner-controlled KYC role + producer-self-served profile. `setProfile(uri)` is open to any caller (writes own row); `setKyc(producer, bool)` is gated to `KYC_ADMIN_ROLE`. Constructor takes `owner_` (deployer by default). Deploy block `40795638`. EIP-55 checksum required by viem. |
| **MockUSDC** | [`0xF286970e2470948abB010B4DD35e1AD2Da3397B0`](https://sepolia.basescan.org/address/0xF286970e2470948abB010B4DD35e1AD2Da3397B0) | 6-dec testnet USDC. Public `mint(to, amount)` — anyone can mint any amount. Fresh deploy on 2026-04-28; pre-v3 mUSDC at `0x1b0a76…3c47` is abandoned. |

### Implementations (used for each new campaign's proxies)

| Contract | Address |
|---|---|
| Campaign impl (v3 — yearly return + collateral) | [`0x88008017BEA558799A73b5479F6AE159698B48a8`](https://sepolia.basescan.org/address/0x88008017BEA558799A73b5479F6AE159698B48a8) |
| CampaignToken impl | [`0xd5A38dB79B7385aF025A2cf925Ac4B17304a28AF`](https://sepolia.basescan.org/address/0xd5A38dB79B7385aF025A2cf925Ac4B17304a28AF) |
| StakingVault impl | [`0xA37Df5ec09349dDa1E0E7Ca60e1ed3d110EdB987`](https://sepolia.basescan.org/address/0xA37Df5ec09349dDa1E0E7Ca60e1ed3d110EdB987) |
| YieldToken impl | [`0xc5b2cCEf2304B7803F83c3E0800bFB57a6A396e3`](https://sepolia.basescan.org/address/0xc5b2cCEf2304B7803F83c3E0800bFB57a6A396e3) |
| HarvestManager impl (v3 — depositFromCollateral) | [`0x2D1725C10DAfB1575e5f3d457Aa5B2a7C2bb16f4`](https://sepolia.basescan.org/address/0x2D1725C10DAfB1575e5f3d457Aa5B2a7C2bb16f4) |
| Factory impl (v3 — passes yearly + coverage to new campaigns) | [`0x83B3297A21AeDc79b406b98221BE1ff4ee9A817d`](https://sepolia.basescan.org/address/0x83B3297A21AeDc79b406b98221BE1ff4ee9A817d) |

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
