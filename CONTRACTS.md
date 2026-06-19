# GrowFi — Deployments

## Ethereum Mainnet (chain 1) — v4 audit-hardened launch

**Deployed:** 2026-06-16 · **Audit implementation patch:** block `25328977` · **Deployer/owner:** `0xA229F3c9851E26fC9eA18157b88cd1CDA6F90e55` · **Factory deploy block:** `25328624`

> Fresh full v4 deploy on Ethereum Mainnet, followed before any campaign
> existed by an implementation-pointer patch to the merged 2026-06
> audit-hardened build. No campaigns were seeded during launch; the first
> production campaign must be created manually through the app. Real USDC is
> the only enabled payment/stablecoin policy at launch. UGraph serves the
> mainnet index at `https://ugraph.growfi.dev/subgraphs/growfi/latest/gn`.
>
> Fee receiver / operations Safe: `0x1f91747D9BF455842CD7f1555f52Ae581F6AA9b9`
> (threshold 2; owners `0x2DC077446182287f1d79847074893CDb559D41f4` and
> `0xe6c30ad5aee7ad22e9f39d51d67667587cdd05a1`). Factory/protocol owner remains
> the deployer during the launch phase.

### Core v4 + GROW

| Contract | Address |
|---|---|
| CampaignFactory (proxy) | [`0x81c2ecb09B8062cC9F3A4F8682318456304f4aE2`](https://etherscan.io/address/0x81c2ecb09B8062cC9F3A4F8682318456304f4aE2) |
| CampaignFactory impl | [`0x3EEeD505C21C945845Fb8f57917B035532E0Ac87`](https://etherscan.io/address/0x3EEeD505C21C945845Fb8f57917B035532E0Ac87) |
| Campaign impl | [`0xE2c24D56b90BAe3Db93E4a7E4c5B46d91545020b`](https://etherscan.io/address/0xE2c24D56b90BAe3Db93E4a7E4c5B46d91545020b) |
| CampaignToken impl | [`0x53b2c6C52363C36BF35D728A15a36DFC0882c11b`](https://etherscan.io/address/0x53b2c6C52363C36BF35D728A15a36DFC0882c11b) |
| StakingVault impl | [`0xA9Ae8956B199A2f8a087584cA3B7cf9Fca5066D1`](https://etherscan.io/address/0xA9Ae8956B199A2f8a087584cA3B7cf9Fca5066D1) |
| YieldToken impl | [`0xfC5e8518a0C6cb87A7a98293f6Ed0E87fCe2aC20`](https://etherscan.io/address/0xfC5e8518a0C6cb87A7a98293f6Ed0E87fCe2aC20) |
| HarvestManager impl | [`0x852987797CCB62735B9880CEaE3251e948bcBA50`](https://etherscan.io/address/0x852987797CCB62735B9880CEaE3251e948bcBA50) |
| SaleClassicModule impl | [`0x82dea032125FB620E104BF4837c3dEE43C52444E`](https://etherscan.io/address/0x82dea032125FB620E104BF4837c3dEE43C52444E) |
| CollateralModule impl | [`0x09cC36a83fd80C278B16A9F91b4360782bf4E9f6`](https://etherscan.io/address/0x09cC36a83fd80C278B16A9F91b4360782bf4E9f6) |
| RepaymentModule impl | [`0x34326058FD53c773Fd7E67a20af17d73ae4d793A`](https://etherscan.io/address/0x34326058FD53c773Fd7E67a20af17d73ae4d793A) |
| EcommerceModule impl | [`0x5214CA79f4eb9298e506e2B3181aF0aD24B9Bd4c`](https://etherscan.io/address/0x5214CA79f4eb9298e506e2B3181aF0aD24B9Bd4c) |
| DebtRestructuringModule impl | [`0x6411BA1923A71E7dAA9BD738D31fF9F81B80319a`](https://etherscan.io/address/0x6411BA1923A71E7dAA9BD738D31fF9F81B80319a) |
| CampaignRegistry | [`0xA3AEb95Ff4555E266aa1366000204a75FaD4142B`](https://etherscan.io/address/0xA3AEb95Ff4555E266aa1366000204a75FaD4142B) |
| ProducerRegistry | [`0x651fb29e69Bde3ADE988e8E75e9A3012272D2de5`](https://etherscan.io/address/0x651fb29e69Bde3ADE988e8E75e9A3012272D2de5) |
| GrowfiToken (proxy) | [`0xDcb4af0c05bc86D4F3C3351f30735b56a70ad725`](https://etherscan.io/address/0xDcb4af0c05bc86D4F3C3351f30735b56a70ad725) |
| GrowfiToken impl | [`0xdB8Da814194ADbe8E4fe80Cff87d10f483623D1E`](https://etherscan.io/address/0xdB8Da814194ADbe8E4fe80Cff87d10f483623D1E) |
| GrowfiTreasury (proxy) | [`0x47ea5710ea674f5D653A59c96836E2d20288813a`](https://etherscan.io/address/0x47ea5710ea674f5D653A59c96836E2d20288813a) |
| GrowfiTreasury impl | [`0x36DE403428280C10e7332534ae0f80e01FFa5982`](https://etherscan.io/address/0x36DE403428280C10e7332534ae0f80e01FFa5982) |
| GrowfiMinter (proxy) | [`0x3D44d8c9D078f3aD92CacE67C09DdE9e8172A98B`](https://etherscan.io/address/0x3D44d8c9D078f3aD92CacE67C09DdE9e8172A98B) |
| GrowfiFeeSplitter (proxy) | [`0x18b1E79F7b7a802f75e7F2261a9f7f2Bfbcd831f`](https://etherscan.io/address/0x18b1E79F7b7a802f75e7F2261a9f7f2Bfbcd831f) |
| GrowfiStakingPool (proxy) | [`0xD4f6c69457F34332D3cd9ea287F69a91e84a803A`](https://etherscan.io/address/0xD4f6c69457F34332D3cd9ea287F69a91e84a803A) |

### Mainnet stablecoin config

| Token | Address | Decimals | Feed | Treasury accepted |
|---|---|---:|---|:-:|
| USDC | [`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`](https://etherscan.io/address/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48) | 6 | [`0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6`](https://etherscan.io/address/0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6) | yes |

Treasury stablecoin config: scale `1e12`, heartbeat `86400`, depeg band
`9500`-`10500`. Factory `minSeasonDuration` is `2592000` seconds (30 days).

### Frontend env (Ethereum Mainnet)

```ini
NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_FACTORY_ADDRESS=0x81c2ecb09B8062cC9F3A4F8682318456304f4aE2
NEXT_PUBLIC_USDC_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
NEXT_PUBLIC_REGISTRY_ADDRESS=0xA3AEb95Ff4555E266aa1366000204a75FaD4142B
NEXT_PUBLIC_PRODUCER_REGISTRY_ADDRESS=0x651fb29e69Bde3ADE988e8E75e9A3012272D2de5
NEXT_PUBLIC_REPAYMENT_IMPL=0x34326058FD53c773Fd7E67a20af17d73ae4d793A
NEXT_PUBLIC_ECOMMERCE_IMPL=0x5214CA79f4eb9298e506e2B3181aF0aD24B9Bd4c
NEXT_PUBLIC_DEBT_RESTRUCTURING_IMPL=0x6411BA1923A71E7dAA9BD738D31fF9F81B80319a
NEXT_PUBLIC_GROW_TOKEN=0xDcb4af0c05bc86D4F3C3351f30735b56a70ad725
NEXT_PUBLIC_GROW_TREASURY=0x47ea5710ea674f5D653A59c96836E2d20288813a
NEXT_PUBLIC_GROW_MINTER=0x3D44d8c9D078f3aD92CacE67C09DdE9e8172A98B
NEXT_PUBLIC_GROW_FEE_SPLITTER=0x18b1E79F7b7a802f75e7F2261a9f7f2Bfbcd831f
NEXT_PUBLIC_GROW_STAKING_POOL=0xD4f6c69457F34332D3cd9ea287F69a91e84a803A
NEXT_PUBLIC_SUBGRAPH_URL=https://ugraph.growfi.dev/subgraphs/growfi/latest/gn
```

---

## Base Sepolia (chain 84532) — v4 audit-hardened rebuild

**Deployed:** 2026-06-11 · **Deployer/owner:** `0xFF6bdef4fB646EE44e29FE8FC0862B02F0Ba8a33` · **Factory deploy block:** `42697602`

> Fresh full v4 deploy on Base Sepolia from the 2026-06 audit-hardened build
> (auto-activation removed, Treasury `minCap>0` + `isCampaign` guard, escrow-safe
> `endCampaign`, repayment `currentSupply` sync, monotonic `minCap`, separate
> factory/producer pause, zero-GROW dust guard). 5 seed campaigns, including one
> with the **DebtRestructuringModule** attached. Subgraph indexed locally for
> verification; ugraph production push pending.

### Core v4 + GROW + stables

| Contract | Address |
|---|---|
| CampaignFactory (proxy) | `0xAf81c05747EDA1e1715fF23626ab83c3351dCfF6` |
| CampaignFactory impl | `0x183f5f21A39890E2E1b6EB65D48e5c9E9480d6D3` |
| Campaign impl | `0x2Db5e242755E44b70bB84C030d841729DC1f2869` |
| CampaignToken impl | `0x9FD2705c264901Ed656C2803249f2f40f4268206` |
| StakingVault impl | `0xF8aA824C02596c7f3eDbe487d5602389d8d955B7` |
| YieldToken impl | `0xd8eD0d2bC7B9A30F4073Bc0C11E60D6eAE083d6F` |
| HarvestManager impl | `0xA2bC85c0E4440dA0A0E5EdFA047ccae207B5EA14` |
| SaleClassicModule impl | `0xceA009E498BE9e4cf0386BB2E66FE000a34C878f` |
| CollateralModule impl | `0x8931f022248C92A66de12036723506C3aE77ca96` |
| RepaymentModule impl | `0x039BC1531A427D299bbeae37D4fb6eE9Ebf4477E` |
| EcommerceModule impl | `0x4C561d79CD7f99E53C75cD44601A94E12B37e1E2` |
| DebtRestructuringModule impl | `0x204591b6A10479B21A841937489Ea89562f608FB` |
| CampaignRegistry | `0xf15E94B1db45eF645Ca611D62ECC6b10F5461515` |
| ProducerRegistry | `0x0ad6Af458718963aeE1C7C4e142427E9c2c381a7` |
| MockUSDC (6) | `0x784d2221e11f4E87FA031aAC15c168D27b5cCeb4` |
| MockUSDT (6) | `0x9c872074c9fc38E5e777ff53EeEcBC61d1Cf3186` |
| MockDAI (18) | `0x18d1777Cc183F6073D585F934335a773ffC7284c` |
| GrowfiToken (proxy) | `0x88E1Fd001D09bE235BbEbeEd19e33E7abCF5385E` |
| GrowfiTreasury (proxy) | `0x66B3b38FCe61b0E5C96e9a1F0279321b14aC54D0` |
| GrowfiMinter (proxy) | `0xa9D37cEF4756349ad2BE0023643122Af16868B57` |
| GrowfiFeeSplitter (proxy) | `0xF0Ad36ef051742b4397048Aa4d5D7AB08F88FEf7` |
| GrowfiStakingPool (proxy) | `0x0BfbC2dCc439CeA0d2b6b8a7B759C5af583A5E00` |
| MockOracle ($1 peg) | `0xa35b4E2C791E242052eD4596aC2fA86Ad7f9EBa2` |

### Seed campaigns (all Active)

| Campaign | Address | Notes |
|---|---|---|
| Olive Sicily (OLIVE) | `0xE5816a75B7DBB5110C8847b573a9c584d6613628` | $0.144/CT, tracked in Treasury |
| Vineyard of Etna (ETNA) | `0x90005164979714D1670acc5B0E30214B25A15D85` | $0.10/CT, tracked in Treasury |
| Ecommerce Olive Shop (ESHOP) | `0xAc8b683626aD1EE08B1abab63e6ca08eA47B58C0` | Ecommerce + Repayment attached |
| Repayment Vineyard (RPAY) | `0xB2ae1c8F4461FaFD3af0Db9E5bDc5cE89316E080` | Repayment pool 2,000 USDC |
| Almond Grove Restructure (ALMD) | `0x059C43A62C7D2E218570d539d1Cd94CC6D1f4263` | **DebtRestructuringModule attached** |

---

## Ethereum Sepolia (chain 11155111) — v4 module architecture + GROW system

**Deployed:** 2026-05-12 · **Refreshed:** 2026-05-29 · **Deployer/owner:** `0xFF6bdef4fB646EE44e29FE8FC0862B02F0Ba8a33`

> Current v4 deployment on an L1 testnet, ahead of the Ethereum mainnet
> target. Module-based Campaign architecture (host + delegatecall router
> + Sale/Collateral/Repayment modules) replaces the v3 monolith. GROW
> system (Token + Treasury + Minter + FeeSplitter + StakingPool) is wired
> in a separate broadcast on top.
>
> Seed campaigns: Olive Sicily ($0.144/CT, 350k maxCap), Vineyard of Etna
> ($0.10/CT, 500k maxCap), plus the Ecommerce Olive Shop demo. All are Active.
>
> Subgraph: served through the ugraph gateway. Direct legacy endpoints and
> the stale `prod` tag were removed; use
> `https://ugraph.growfi.dev/subgraphs/growfi/latest/gn`.

### Core v4 (campaign factory + module impls + registries)

| Contract | Address | Notes |
|---|---|---|
| **CampaignFactory** (proxy) | [`0xa4DEd8Ab35e89bCAF1f7DFeb7aB2c1ED533b3f05`](https://sepolia.etherscan.io/address/0xa4DEd8Ab35e89bCAF1f7DFeb7aB2c1ED533b3f05) | v4 permissionless factory. `FUNDING_FEE_BPS=300`, `HARVEST_PROTOCOL_FEE_BPS=200`. Deploy block `10838711`. |
| CampaignFactory impl | [`0x3d5d61B061Ce5F717D34b47638e67c5d7ba5c393`](https://sepolia.etherscan.io/address/0x3d5d61B061Ce5F717D34b47638e67c5d7ba5c393) | 2026-05-29 audit hardening upgrade: campaign payment-token policy, module replacement helper, selector snapshot support. |
| **Campaign host** impl | [`0x4E53CF93D2927D225668EE570Dc3fA8b55917130`](https://sepolia.etherscan.io/address/0x4E53CF93D2927D225668EE570Dc3fA8b55917130) | Delegatecall router, namespaced storage, module attach/detach/enabled lifecycle, selector snapshots. |
| CampaignToken impl | [`0x81C4e22EC9198f2983217C483e4027cf49E940db`](https://sepolia.etherscan.io/address/0x81C4e22EC9198f2983217C483e4027cf49E940db) | |
| StakingVault impl | [`0x092Ed1e0845f6817e24316A730E98ec074e5F017`](https://sepolia.etherscan.io/address/0x092Ed1e0845f6817e24316A730E98ec074e5F017) | `forceUnstake` now mints accrued YIELD to owner (no forfeit) — producer-blessed exit path used by `RepaymentModule.redeem`. |
| YieldToken impl | [`0x8d434e38dd91D9b738f8803dbD18b815720BEDad`](https://sepolia.etherscan.io/address/0x8d434e38dd91D9b738f8803dbD18b815720BEDad) | |
| HarvestManager impl | [`0x38da3922d3Bc3281F57946618404F0E341777F68`](https://sepolia.etherscan.io/address/0x38da3922d3Bc3281F57946618404F0E341777F68) | |
| **SaleClassicModule** impl | [`0x5f0C6aB3BE2Ab2A437468A849ba69ee00aC17039`](https://sepolia.etherscan.io/address/0x5f0C6aB3BE2Ab2A437468A849ba69ee00aC17039) | Default auto-attached on every `createCampaign`. Enforces factory token policy, fixed-rate validation, isolated funding escrow, bounded sell-back accounting, buy/sellback/buyback/setMaxCap. |
| **CollateralModule** impl | [`0xF2EAb14F7288E7d4E611C44F2784dfF6394ec476`](https://sepolia.etherscan.io/address/0xF2EAb14F7288E7d4E611C44F2784dfF6394ec476) | Default auto-attached. `lockCollateral`, `depositUSDC`, `settleSeasonShortfall`. |
| **RepaymentModule** impl | [`0xc3B052EA719b8BAe6AFb32bfe6b8D2B8fc2580D6`](https://sepolia.etherscan.io/address/0xc3B052EA719b8BAe6AFb32bfe6b8D2B8fc2580D6) | Whitelisted but NOT default. Producer attaches post-create. Refund = principal (from on-chain `pricePerToken`) + producer-set `bonusPerCt`. |
| **EcommerceModule** impl | [`0x4921f38F3D0de21057Ef202629D501E8b99d8616`](https://sepolia.etherscan.io/address/0x4921f38F3D0de21057Ef202629D501E8b99d8616) | Whitelisted but NOT default. Producer attaches post-create for SKU checkout. |
| CampaignRegistry | [`0xAef1Cb97C9a8CC2d06d6C662F6655009DED1E1BE`](https://sepolia.etherscan.io/address/0xAef1Cb97C9a8CC2d06d6C662F6655009DED1E1BE) | `(campaign → metadataURI)` + monotonic version. |
| ProducerRegistry | [`0x8DDc90F40Bf8847672EA5B256d93607F42Fd540E`](https://sepolia.etherscan.io/address/0x8DDc90F40Bf8847672EA5B256d93607F42Fd540E) | KYC role + producer-self-served profile. |

### Stablecoins (testnet mocks, public mint)

| Contract | Address | Decimals | Treasury accepted |
|---|---|---:|:-:|
| MockUSDC | [`0x32C344Dc9713d904442d0E5B0d2b7994E52B0d4E`](https://sepolia.etherscan.io/address/0x32C344Dc9713d904442d0E5B0d2b7994E52B0d4E) | 6 | ✅ |
| MockUSDT | [`0x7c47aa550061117f8440128c6b829da5bf88de06`](https://sepolia.etherscan.io/address/0x7c47aa550061117f8440128c6b829da5bf88de06) | 6 | ✅ |
| MockDAI | [`0x3540ea8a6fa084a31321e790b89a6fbe677ae00e`](https://sepolia.etherscan.io/address/0x3540ea8a6fa084a31321e790b89a6fbe677ae00e) | 18 | ✅ |

Each peg feed is a `MockOracle($1, 8-dec)` deployed alongside the
stablecoin and wired with 24h heartbeat + 95-105% depeg band.

### GROW system (deployed 2026-05-12 on top of v4 core, block 10838846)

| Contract | Address | Notes |
|---|---|---|
| **GrowfiToken** (proxy) | [`0x9bB4f9C41ed922282C181f2f3e01d8384c960b44`](https://sepolia.etherscan.io/address/0x9bB4f9C41ed922282C181f2f3e01d8384c960b44) | Genesis: 0 to deployer, 100k to Treasury reserve (excluded from `circulating`). Boot reference price $0.10, 10% markup. |
| **GrowfiTreasury** (proxy) | [`0xB71D13F80ceAed17A179B4e0D9eb1e8410DeaDDd`](https://sepolia.etherscan.io/address/0xB71D13F80ceAed17A179B4e0D9eb1e8410DeaDDd) | Current impl [`0xBDB6162d6027085191D6D883c745FbADF176aa5F`](https://sepolia.etherscan.io/address/0xBDB6162d6027085191D6D883c745FbADF176aa5F). `automationEnabled=true`; zeroes stablecoin allowance after direct GROW buys; Treasury excluded from Minter emission. |
| **GrowfiMinter** (proxy) | [`0xD99c1985B257a4A55bA8D0836Fab536389cdd24C`](https://sepolia.etherscan.io/address/0xD99c1985B257a4A55bA8D0836Fab536389cdd24C) | 3-tier bonding curve 1.0×/0.7×/0.4× over cumulative USD per campaign. |
| **GrowfiFeeSplitter** (proxy) | [`0xF1a8527E00916588f4Bb137cE450E8459b6BD436`](https://sepolia.etherscan.io/address/0xF1a8527E00916588f4Bb137cE450E8459b6BD436) | 30% Treasury / 70% Ops. Set as `factory.protocolFeeRecipient`. |
| **GrowfiStakingPool** (proxy) | [`0xD1D8491370A8CF597bEcFc49D3253BfFAF34CDc8`](https://sepolia.etherscan.io/address/0xD1D8491370A8CF597bEcFc49D3253BfFAF34CDc8) | Current impl [`0x7554BBc5F6bdA2134dFb3175BB0F8D9fe512Dc6c`](https://sepolia.etherscan.io/address/0x7554BBc5F6bdA2134dFb3175BB0F8D9fe512Dc6c). Stake $GROW, earn USDC via `Treasury.claimUsdcAndDistribute`; blended stake age and undistributed reward accounting. |

### Seed campaigns (smoke 2026-05-12 and 2026-05-18)

| Campaign | Address | Token | Price |
|---|---|---|---:|
| Olive Sicily | [`0x3280d078424FDE86fdE23688561FF377278071de`](https://sepolia.etherscan.io/address/0x3280d078424FDE86fdE23688561FF377278071de) | `OLIVE` | $0.144 |
| Vineyard of Etna | [`0xd99EB722e7D4499f95A60FEEB19Cd1057bad8F2c`](https://sepolia.etherscan.io/address/0xd99EB722e7D4499f95A60FEEB19Cd1057bad8F2c) | `ETNA` | $0.10 |
| Ecommerce Olive Shop Demo | [`0x9736898EcE96c7F383499254293a76109452A47F`](https://sepolia.etherscan.io/address/0x9736898EcE96c7F383499254293a76109452A47F) | `ESHOP` | $0.10 |

### Frontend env (Sepolia ETH)

```ini
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_FACTORY_ADDRESS=0xa4DEd8Ab35e89bCAF1f7DFeb7aB2c1ED533b3f05
NEXT_PUBLIC_USDC_ADDRESS=0x32C344Dc9713d904442d0E5B0d2b7994E52B0d4E
NEXT_PUBLIC_USDT_ADDRESS=0x7c47aa550061117f8440128c6b829da5bf88de06
NEXT_PUBLIC_DAI_ADDRESS=0x3540ea8a6fa084a31321e790b89a6fbe677ae00e
NEXT_PUBLIC_REGISTRY_ADDRESS=0xAef1Cb97C9a8CC2d06d6C662F6655009DED1E1BE
NEXT_PUBLIC_PRODUCER_REGISTRY_ADDRESS=0x8DDc90F40Bf8847672EA5B256d93607F42Fd540E
NEXT_PUBLIC_REPAYMENT_IMPL=0xc3B052EA719b8BAe6AFb32bfe6b8D2B8fc2580D6
NEXT_PUBLIC_ECOMMERCE_IMPL=0x4921f38F3D0de21057Ef202629D501E8b99d8616
NEXT_PUBLIC_DEBT_RESTRUCTURING_IMPL=
NEXT_PUBLIC_GROW_TOKEN=0x9bB4f9C41ed922282C181f2f3e01d8384c960b44
NEXT_PUBLIC_GROW_TREASURY=0xB71D13F80ceAed17A179B4e0D9eb1e8410DeaDDd
NEXT_PUBLIC_GROW_MINTER=0xD99c1985B257a4A55bA8D0836Fab536389cdd24C
NEXT_PUBLIC_GROW_FEE_SPLITTER=0xF1a8527E00916588f4Bb137cE450E8459b6BD436
NEXT_PUBLIC_GROW_STAKING_POOL=0xD1D8491370A8CF597bEcFc49D3253BfFAF34CDc8
NEXT_PUBLIC_SUBGRAPH_URL=https://ugraph.growfi.dev/subgraphs/growfi/latest/gn
```

---

## Base Sepolia (chain 84532) — legacy v3.3 (archived)

**Deployed:** 2026-04-28 (v3.3 fresh demo redeploy) · **Deployer/owner:** `0xFF6bdef4fB646EE44e29FE8FC0862B02F0Ba8a33`

> Fresh full redeploy of every contract for a clean demo platform —
> factory + 5 impls + mUSDC mock + 2 registries from a single forge
> session. The deployer/owner has been granted `KYC_ADMIN_ROLE` on the
> ProducerRegistry and KYC-flagged the seed producer (Alice = deployer).
>
> Single seeded test campaign on the new factory at
> `0xEECa254825e78e995D630701D26c7356887Ec6c9`: $50,400 max raise,
> $5,000/yr commitment from year 2030, 3 harvests covered by $15,000
> USDC of collateral; Alice + Bob both staked, season 1 running.
>
> Subgraph: the archived hosted index for this legacy deploy was removed
> during the 2026-05-17 cleanup. No live Base Sepolia subgraph endpoint is
> retained.
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
| **CampaignFactory** (proxy) | [`0x26dfae1d399a737708aab1f9a116eb814e98ee87`](https://sepolia.basescan.org/address/0x26dfae1d399a737708aab1f9a116eb814e98ee87) | v3.3 — permissionless campaign creation. Deploy block `40817442`. |
| **CampaignRegistry** | [`0x40696756DE89c0C5DF59219e565b4a1F18e909ea`](https://sepolia.basescan.org/address/0x40696756DE89c0C5DF59219e565b4a1F18e909ea) | Onchain map `campaign → metadataURI` + monotonic `version`. Deploy block `40817471`. |
| **ProducerRegistry** | [`0xe5ed3b78631a02EAB46477F67c2b41Ec31a97A21`](https://sepolia.basescan.org/address/0xe5ed3b78631a02EAB46477F67c2b41Ec31a97A21) | v3 — owner-controlled KYC role + producer-self-served profile. Deploy block `40817476`. |
| **MockUSDC** | [`0x9c92c69a92173548a8e62a412e963f4b93ee2a13`](https://sepolia.basescan.org/address/0x9c92c69a92173548a8e62a412e963f4b93ee2a13) | 6-dec testnet USDC. Public `mint(to, amount)`. Pre-v3.3-redeploy mUSDCs abandoned. |

### Test campaign (single)

| Field | Value |
|---|---|
| Campaign proxy | [`0xEECa254825e78e995D630701D26c7356887Ec6c9`](https://sepolia.basescan.org/address/0xEECa254825e78e995D630701D26c7356887Ec6c9) |
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
| Campaign impl (v3.3) | [`0x7350cc5b192f9f03eaa40fafb206f15b9be5e282`](https://sepolia.basescan.org/address/0x7350cc5b192f9f03eaa40fafb206f15b9be5e282) |
| CampaignToken impl | [`0xb21a38294fbf740d7c66054c1a288a3c68ff6f96`](https://sepolia.basescan.org/address/0xb21a38294fbf740d7c66054c1a288a3c68ff6f96) |
| StakingVault impl | [`0x5ec4bd275d878b33a31be0d5798949033727f38d`](https://sepolia.basescan.org/address/0x5ec4bd275d878b33a31be0d5798949033727f38d) |
| YieldToken impl | [`0xf7d9376b75ed66f16f5891b195451a80bc4cf715`](https://sepolia.basescan.org/address/0xf7d9376b75ed66f16f5891b195451a80bc4cf715) |
| HarvestManager impl (v3 — depositFromCollateral) | [`0x4f9efaf3df08cc7090aff6a64cee1ec2c316d790`](https://sepolia.basescan.org/address/0x4f9efaf3df08cc7090aff6a64cee1ec2c316d790) |
| Factory impl (v3.3) | [`0xef5cbe2a426cb51f4f7fbe3f4be5cbc1a0515411`](https://sepolia.basescan.org/address/0xef5cbe2a426cb51f4f7fbe3f4be5cbc1a0515411) |

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

- Direct legacy endpoints were removed.
- No live Base Sepolia subgraph endpoint is retained; the active indexed environment is Ethereum Sepolia through `https://ugraph.growfi.dev/subgraphs/growfi/latest/gn`.

---

## Frontend `.env.local`

```bash
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_FACTORY_ADDRESS=0x26dfae1d399a737708aab1f9a116eb814e98ee87
NEXT_PUBLIC_USDC_ADDRESS=0x9c92c69a92173548a8e62a412e963f4b93ee2a13
NEXT_PUBLIC_REGISTRY_ADDRESS=0x40696756DE89c0C5DF59219e565b4a1F18e909ea
NEXT_PUBLIC_PRODUCER_REGISTRY_ADDRESS=0xe5ed3b78631a02EAB46477F67c2b41Ec31a97A21
# No live Base Sepolia subgraph retained.
NEXT_PUBLIC_BACKEND_URL=http://localhost:4001
```

> **EIP-55 gotcha**: viem's address validator rejects mixed-case strings that aren't valid EIP-55 checksums. Run `cast to-check-sum-address 0x...` after any new deploy. The addresses above are already in the correct checksum form.

---

## Quick interactions

### Get test USDC (anyone)

```bash
cast send 0x9c92c69a92173548a8e62a412e963f4b93ee2a13 \
  "mint(address,uint256)" <YOUR_ADDRESS> 10000000000 \
  --rpc-url https://sepolia.base.org --private-key $YOUR_PK
# → 10,000 mUSDC (6 decimals)
```

### Read factory state

```bash
cast call 0x26dfae1d399a737708aab1f9a116eb814e98ee87 \
  "getCampaignCount()(uint256)" --rpc-url https://sepolia.base.org
```

### Create a campaign (as producer)

Use the frontend at `/create`, or raw call:

```bash
cast send 0x26dfae1d399a737708aab1f9a116eb814e98ee87 \
  "createCampaign((address,string,string,string,string,uint256,uint256,uint256,uint256,uint256,uint256))" \
  "(<YOUR_ADDRESS>,Olive Tree,OLIVE,Olive Yield,oYIELD,144000000000000000,10000000000000000000000,100000000000000000000000,$(( $(date +%s) + 7776000 )),15552000,5000000000000000000)" \
  --rpc-url https://sepolia.base.org --private-key $YOUR_PK
# price 0.144 USD, minCap 10k, maxCap 100k, deadline +90d, season 180d, minProductClaim 5e18
```

### Set/update producer profile (any address)

```bash
cast send 0xe5ed3b78631a02EAB46477F67c2b41Ec31a97A21 \
  "setProfile(string)" \
  "https://growfi-media.fra1.digitaloceanspaces.com/profiles/<cid>.json" \
  --rpc-url https://sepolia.base.org --private-key $YOUR_PK
```

### Set/update campaign metadata URI (as producer)

```bash
cast send 0x40696756DE89c0C5DF59219e565b4a1F18e909ea \
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
# Deployment is served through ugraph; see platform/subgraph/DEPLOY.md before changing the live indexer.
```

Update `platform/frontend/.env.local` + `src/contracts/tokens.ts` (KNOWN_TOKENS mUSDC address) + re-extract ABIs to `src/contracts/abis/`.
