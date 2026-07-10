# GrowFi — Deployments

## Ethereum Mainnet (chain 1) — current production state

**Factory deployed:** 2026-06-16 at block `25328624` · **Security rollout:**
2026-07-10, blocks `25501399`-`25501432` · **On-chain inventory verified at
block:** `25501436` ·
**Owner:** `0xA229F3c9851E26fC9eA18157b88cd1CDA6F90e55`

The values in this section are a live-state inventory, not deployment-script
defaults. Proxy implementations and admins were read directly from the
ERC-1967 slots; Factory pointers, module approvals, defaults, campaign stacks,
and attached modules were read from contract state. Runtime code hashes are
stored in `deployments/mainnet.json`. Run
`npm --prefix platform/backend run verify:mainnet-addresses` to compare that
manifest, this document, app configuration, and the current chain state.

The owner is an EOA, not a Safe. All ProxyAdmins listed below are owned by the
same EOA. The UGraph endpoint is
`https://ugraph.growfi.dev/subgraphs/growfi/latest/gn`.

### July 2026 security rollout transaction ledger

All 22 transactions succeeded on Ethereum mainnet. The sequence was executed
serially so each state transition was confirmed before the next one was sent.

| # | Block | Action | Transaction |
|---:|---:|---|---|
| 1 | 25501399 | Deploy Factory implementation | [`0xfe71461aff53e1f6b4ccb080f94199cb9553f2a9bc842a46fa54d1bea9d2b3d1`](https://etherscan.io/tx/0xfe71461aff53e1f6b4ccb080f94199cb9553f2a9bc842a46fa54d1bea9d2b3d1) |
| 2 | 25501400 | Deploy Treasury implementation | [`0xc13850c03234f8c7ff8a6fa3d1e7825e72bbc5ea4376881d67105bc5498ab297`](https://etherscan.io/tx/0xc13850c03234f8c7ff8a6fa3d1e7825e72bbc5ea4376881d67105bc5498ab297) |
| 3 | 25501401 | Deploy StakingVault implementation | [`0x92e9775c6b6db41e32568337bd72d941466c9b7669647071d71bdf13f06e4e53`](https://etherscan.io/tx/0x92e9775c6b6db41e32568337bd72d941466c9b7669647071d71bdf13f06e4e53) |
| 4 | 25501402 | Deploy SaleClassic implementation | [`0xae4ad387b598603f74f0464939ff20f6b864f0f78a315da6a4067499e54f8579`](https://etherscan.io/tx/0xae4ad387b598603f74f0464939ff20f6b864f0f78a315da6a4067499e54f8579) |
| 5 | 25501404 | Upgrade Factory proxy | [`0xb9ddf433191407ace10c1d2d2337251b1b6e085fc334b9e0e655d2b43729f7d0`](https://etherscan.io/tx/0xb9ddf433191407ace10c1d2d2337251b1b6e085fc334b9e0e655d2b43729f7d0) |
| 6 | 25501408 | Pause campaign 0 | [`0x8a9ce83deaa24432e9a78a5312d68a9ee69c6a9fb8abe34c6648d79068348396`](https://etherscan.io/tx/0x8a9ce83deaa24432e9a78a5312d68a9ee69c6a9fb8abe34c6648d79068348396) |
| 7 | 25501409 | Pause campaign 1 | [`0x21af24f467294c52348486d0bb86c503add5d743b60ed86c21548f5c2dbfcfc9`](https://etherscan.io/tx/0x21af24f467294c52348486d0bb86c503add5d743b60ed86c21548f5c2dbfcfc9) |
| 8 | 25501410 | Upgrade Treasury proxy | [`0x7f80c7e2ed6e616e6013cdd5c2d24d68b4e70c25229cba5cd248d24cee37e4cb`](https://etherscan.io/tx/0x7f80c7e2ed6e616e6013cdd5c2d24d68b4e70c25229cba5cd248d24cee37e4cb) |
| 9 | 25501411 | Set future StakingVault implementation | [`0xf50ece9b3985b38b33cb6232748a10bb46ebec1b8ba3254b508f4473febce330`](https://etherscan.io/tx/0xf50ece9b3985b38b33cb6232748a10bb46ebec1b8ba3254b508f4473febce330) |
| 10 | 25501412 | Update SaleClassic selectors | [`0x5ceff447006d2660c11513448a18a8dd9d6a8b0bd09de65067a20b7b180ef80a`](https://etherscan.io/tx/0x5ceff447006d2660c11513448a18a8dd9d6a8b0bd09de65067a20b7b180ef80a) |
| 11 | 25501413 | Approve new SaleClassic implementation | [`0xa382e6d40bce333c5bef9de4312e2bd6afa19d66d35df8e773584dbb1f60bf5f`](https://etherscan.io/tx/0xa382e6d40bce333c5bef9de4312e2bd6afa19d66d35df8e773584dbb1f60bf5f) |
| 12 | 25501414 | Update Factory default modules | [`0xc02d87efc6223b651e19a57b7e2d6e904f33cf340d56ecf640bde2745cb5f867`](https://etherscan.io/tx/0xc02d87efc6223b651e19a57b7e2d6e904f33cf340d56ecf640bde2745cb5f867) |
| 13 | 25501421 | Upgrade campaign 0 StakingVault | [`0xcd652e18e090b58fa99124df540b1c08af1c7b337ca9306f5c813d279dbddd85`](https://etherscan.io/tx/0xcd652e18e090b58fa99124df540b1c08af1c7b337ca9306f5c813d279dbddd85) |
| 14 | 25501422 | Initialize campaign 0 season stake | [`0x93c04b9375d621956037b30b62806d4ca632773a7dc4daf879c9a01098d945e8`](https://etherscan.io/tx/0x93c04b9375d621956037b30b62806d4ca632773a7dc4daf879c9a01098d945e8) |
| 15 | 25501424 | Replace campaign 0 SaleClassic | [`0x552a76ace504b8fcd7c07b7357c1cce66da44c353f1f32ccd5406fa2cf264bbd`](https://etherscan.io/tx/0x552a76ace504b8fcd7c07b7357c1cce66da44c353f1f32ccd5406fa2cf264bbd) |
| 16 | 25501425 | Upgrade campaign 1 StakingVault | [`0x49b45f21b2211d703cdf8f82790d4ad32f353e0801a988ab7c32775a00b03d58`](https://etherscan.io/tx/0x49b45f21b2211d703cdf8f82790d4ad32f353e0801a988ab7c32775a00b03d58) |
| 17 | 25501426 | Initialize campaign 1 season stake | [`0x4e6a2d0a85116272b9f7443e6d92a84bf2763f2a56474fa7b4c6b801f745a314`](https://etherscan.io/tx/0x4e6a2d0a85116272b9f7443e6d92a84bf2763f2a56474fa7b4c6b801f745a314) |
| 18 | 25501427 | Replace campaign 1 SaleClassic | [`0x29379e0d8de2e85de8c890b187dd1708dbf864a3f8ed6f18de1f7250e5edfbad`](https://etherscan.io/tx/0x29379e0d8de2e85de8c890b187dd1708dbf864a3f8ed6f18de1f7250e5edfbad) |
| 19 | 25501429 | Revoke campaign 0 prior SaleClassic | [`0xe6e14ca629001efd3fd677f7e2c57cc84c5aff4bac110ebd6cd2d94f998f2d0c`](https://etherscan.io/tx/0xe6e14ca629001efd3fd677f7e2c57cc84c5aff4bac110ebd6cd2d94f998f2d0c) |
| 20 | 25501430 | Revoke campaign 1 prior SaleClassic | [`0x7717ac9890d00482f57a1264ea6afab8fa670bedc383c2bbec4475b2eddcdde5`](https://etherscan.io/tx/0x7717ac9890d00482f57a1264ea6afab8fa670bedc383c2bbec4475b2eddcdde5) |
| 21 | 25501431 | Unpause campaign 0 | [`0xdaaab825a70605eab99256158f58c63f210568d0816acaa8e63a19d83918d352`](https://etherscan.io/tx/0xdaaab825a70605eab99256158f58c63f210568d0816acaa8e63a19d83918d352) |
| 22 | 25501432 | Unpause campaign 1 | [`0x8bc87548cf81d829747c29645139176ffb5c12c624e76a89229c1817c5f47891`](https://etherscan.io/tx/0x8bc87548cf81d829747c29645139176ffb5c12c624e76a89229c1817c5f47891) |

### Authority, registries, and external infrastructure

| Role | Address | State |
|---|---|---|
| Owner EOA | `0xA229F3c9851E26fC9eA18157b88cd1CDA6F90e55` | Factory owner and every listed ProxyAdmin owner |
| CampaignFactory proxy | `0x81c2ecb09B8062cC9F3A4F8682318456304f4aE2` | Current production Factory |
| CampaignFactory implementation | `0xC591c1c9F3269368457f06540b7EAC06a8A8d269` | July 2026 security upgrade |
| CampaignFactory ProxyAdmin | `0xa65cFB968Ea5b02e38602f5eebFe157BaE6b1473` | Owner EOA controlled |
| CampaignRegistry | `0xA3AEb95Ff4555E266aa1366000204a75FaD4142B` | Non-proxy registry |
| Legacy ProducerRegistry | `0x651fb29e69Bde3ADE988e8E75e9A3012272D2de5` | Immutable pre-social registry; retained until V2 rollout |
| EAS | `0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587` | Canonical Ethereum mainnet EAS; `getSchemaRegistry()` verified on-chain |
| EAS SchemaRegistry | `0xA7b39296258348C78294F95B872b282326A97BDF` | Canonical Ethereum mainnet registry |

### Factory implementation pointers for new campaigns

| Component | Implementation |
|---|---|
| Campaign | `0xE2c24D56b90BAe3Db93E4a7E4c5B46d91545020b` |
| CampaignToken | `0x53b2c6C52363C36BF35D728A15a36DFC0882c11b` |
| StakingVault | `0xe9a9D14227B1bBe6c41de8002098Ef14F4768CEa` |
| YieldToken | `0xfC5e8518a0C6cb87A7a98293f6Ed0E87fCe2aC20` |
| HarvestManager | `0x852987797CCB62735B9880CEaE3251e948bcBA50` |

### GROW system proxies

| Contract | Proxy | Current implementation | ProxyAdmin |
|---|---|---|---|
| GrowfiToken | `0xDcb4af0c05bc86D4F3C3351f30735b56a70ad725` | `0xdB8Da814194ADbe8E4fe80Cff87d10f483623D1E` | `0x161395596Bf49c76127024aae445098238822f58` |
| GrowfiMinter | `0x3D44d8c9D078f3aD92CacE67C09DdE9e8172A98B` | `0x9b45d7cbD6D4Ca54E1221Fb1f8b44E13BD92d66B` | `0x09ea0284C08Dd2864aA1B02d229E4b8417d2868a` |
| GrowfiTreasury | `0x47ea5710ea674f5D653A59c96836E2d20288813a` | `0xAF3c5Bc33E57e0f37723a72B0D2cA1D1F7Ef3594` | `0x38226B48b60cbddca6Fc9DdA94684850468060B9` |
| GrowfiFeeSplitter | `0x18b1E79F7b7a802f75e7F2261a9f7f2Bfbcd831f` | `0x484d5110C280da9F135e85a1E722C4908BafbB08` | `0x90552b96A709EbabD2Ca224394B8424dcC873f5F` |
| GrowfiStakingPool | `0xD4f6c69457F34332D3cd9ea287F69a91e84a803A` | `0xd7C37b9d844b48f886aAA8a7eba237bd337980A1` | `0x406933B2309771B14490d7e002722fbb1eDCdBDC` |

### Module implementation state

Factory approval controls new module attachments. Revocation does not disable a
module already attached to a campaign.

| Module | Implementation | Factory approved | Default | Existing attachment |
|---|---|:-:|:-:|---|
| SaleClassic current | `0x3C5077c5eE8cB22886352f331D105d770693ec5D` | yes | yes | Campaigns 0 and 1 |
| SaleClassic retired A | `0x82dea032125FB620E104BF4837c3dEE43C52444E` | no | no | none after security rollout |
| SaleClassic retired B | `0xa1f01A442359E596D8a98aa7c5595016CeBe193a` | no | no | none after security rollout |
| Collateral current | `0x1e6D432813BA9B4477ACCC87788bf461c1A55B02` | yes | yes | Campaign 1 |
| Collateral earlier approved | `0x09cC36a83fd80C278B16A9F91b4360782bf4E9f6` | yes | no | Campaign 0 |
| Repayment | `0x34326058FD53c773Fd7E67a20af17d73ae4d793A` | yes | no | none |
| Ecommerce current | `0x5214CA79f4eb9298e506e2B3181aF0aD24B9Bd4c` | yes | no | none |
| Ecommerce retired | `0x881883a9fd1c296D198EE9937603E8Eec1AE5E70` | no | no | Campaign 0 |
| DebtRestructuring | `0x6411BA1923A71E7dAA9BD738D31fF9F81B80319a` | yes | no | none |
| CampaignProceedsSplit | `0xb57073310911a902b082d4A7d0CD7dA26e27775D` | yes | no | Campaign 1 |
| DirectIssue | `0x236855EAFb5fbe864E3557f8b621950cBB46d816` | yes | no | Campaign 1 |
| ProjectUpdates | `0x43FD484D3e12071a53181c3727354530230bEFCf` | yes | no | Campaign 1 |

### Existing campaign 0

Producer: `0xE6c30AD5AeE7AD22e9F39D51d67667587cdD05A1`

| Component | Proxy | Current implementation | ProxyAdmin |
|---|---|---|---|
| Campaign | `0x3Cae6813bbA201a1953Caac00A70f3B4e6DAB23f` | `0xE2c24D56b90BAe3Db93E4a7E4c5B46d91545020b` | `0x5B49CeeC63b69f81D60702511fcC75Cb4710ac5a` |
| CampaignToken | `0x64CA37e2ADbd27578805D41eE2F93a20B709ee37` | `0x53b2c6C52363C36BF35D728A15a36DFC0882c11b` | `0x599a55Ee0b7C0E2de8C27125F20639B43Fe51ae3` |
| YieldToken | `0x63862751fb0E30b8eb779078EdE708D4D020bf24` | `0xfC5e8518a0C6cb87A7a98293f6Ed0E87fCe2aC20` | `0x1D50a71b8b9946018E24605D437671eB14Ef9681` |
| StakingVault | `0x2EA8d789B815d5AD34154f622B5dD0A1e94DA060` | `0xe9a9D14227B1bBe6c41de8002098Ef14F4768CEa` | `0x7F810DC8E3D19D6850DcE3d76d4EcaB5dA0F0Ff9` |
| HarvestManager | `0x395FBf71eE5a943a426583F9BBC880847f8e3DE2` | `0x852987797CCB62735B9880CEaE3251e948bcBA50` | `0x1f842639590969180CFeBEAFEF58CBC28f5508D8` |

Attached modules: SaleClassic `0x3C5077c5eE8cB22886352f331D105d770693ec5D`,
Collateral `0x09cC36a83fd80C278B16A9F91b4360782bf4E9f6`, and Ecommerce
`0x881883a9fd1c296D198EE9937603E8Eec1AE5E70`.
The campaign, vault, and harvest manager are unpaused. Season stake accounting
is initialized; `currentSeasonStaked` and `totalStaked` both equal `49,900 CT`.

### Existing campaign 1

Producer: `0xE6c30AD5AeE7AD22e9F39D51d67667587cdD05A1`

| Component | Proxy | Current implementation | ProxyAdmin |
|---|---|---|---|
| Campaign | `0xd9dC6494FD749a015EA682DA49858aBbC3Ac9e14` | `0xE2c24D56b90BAe3Db93E4a7E4c5B46d91545020b` | `0xCd3b98329149840B05FF06f517a815424F639C08` |
| CampaignToken | `0xea70BBbfA4570346875E74f5F297C93c3facc28E` | `0x53b2c6C52363C36BF35D728A15a36DFC0882c11b` | `0xec2337adb74485D9d593C1764Ac85Bd7de6AD33A` |
| YieldToken | `0xb727BD9F445CA98104F64e4ba3Cd8Afe4CE695A0` | `0xfC5e8518a0C6cb87A7a98293f6Ed0E87fCe2aC20` | `0xC3Ca7af3750afE727D956E46ca810Dd44c1bc484` |
| StakingVault | `0xd54A3C5D68CFdbaE7e68aE4DC3787Dbe37237EE8` | `0xe9a9D14227B1bBe6c41de8002098Ef14F4768CEa` | `0x627CEB880705Ad2fe04f81B63d879555ec1382Dc` |
| HarvestManager | `0x45a5e2a94dfb65257d1a3455d31f050aD38d0a04` | `0x852987797CCB62735B9880CEaE3251e948bcBA50` | `0x5f62037E3f30950b97358a5f9E78dE4e36F5384E` |

Attached modules: SaleClassic `0x3C5077c5eE8cB22886352f331D105d770693ec5D`,
Collateral `0x1e6D432813BA9B4477ACCC87788bf461c1A55B02`, CampaignProceedsSplit
`0xb57073310911a902b082d4A7d0CD7dA26e27775D`, DirectIssue
`0x236855EAFb5fbe864E3557f8b621950cBB46d816`, and ProjectUpdates
`0x43FD484D3e12071a53181c3727354530230bEFCf`.
The campaign, vault, and harvest manager are unpaused. Season stake accounting
is initialized; `currentSeasonStaked` and `totalStaked` both equal
`133.266666666666666666 CT`.

### Mainnet assets and oracle

| Asset or service | Address | Protocol state |
|---|---|---|
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | Factory/Treasury enabled; 6 decimals |
| USDT | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | Frontend reference only; not Factory enabled |
| DAI | `0x6B175474E89094C44Da98b954EedeAC495271d0F` | Frontend reference only; not Factory enabled |
| Chainlink USDC/USD | `0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6` | Treasury USDC feed |

Treasury USDC config: scale `1e12`, heartbeat `86400`, depeg band
`9500`-`10500`. Factory `minSeasonDuration` is `2592000` seconds (30 days).

### Frontend env (Ethereum Mainnet)

```ini
NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_FACTORY_ADDRESS=0x81c2ecb09B8062cC9F3A4F8682318456304f4aE2
NEXT_PUBLIC_USDC_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
NEXT_PUBLIC_USDT_ADDRESS=0xdAC17F958D2ee523a2206206994597C13D831ec7
NEXT_PUBLIC_DAI_ADDRESS=0x6B175474E89094C44Da98b954EedeAC495271d0F
NEXT_PUBLIC_REGISTRY_ADDRESS=0xA3AEb95Ff4555E266aa1366000204a75FaD4142B
NEXT_PUBLIC_PRODUCER_REGISTRY_ADDRESS=0x651fb29e69Bde3ADE988e8E75e9A3012272D2de5
NEXT_PUBLIC_REPAYMENT_IMPL=0x34326058FD53c773Fd7E67a20af17d73ae4d793A
NEXT_PUBLIC_ECOMMERCE_IMPL=0x5214CA79f4eb9298e506e2B3181aF0aD24B9Bd4c
NEXT_PUBLIC_DEBT_RESTRUCTURING_IMPL=0x6411BA1923A71E7dAA9BD738D31fF9F81B80319a
NEXT_PUBLIC_PROCEEDS_SPLIT_IMPL=0xb57073310911a902b082d4A7d0CD7dA26e27775D
NEXT_PUBLIC_DIRECT_ISSUE_IMPL=0x236855EAFb5fbe864E3557f8b621950cBB46d816
NEXT_PUBLIC_PROJECT_UPDATES_IMPL=0x43FD484D3e12071a53181c3727354530230bEFCf
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

**Deployed:** 2026-05-12 · **Refreshed:** 2026-07-03 · **Deployer/owner:** `0xFF6bdef4fB646EE44e29FE8FC0862B02F0Ba8a33`

> Current v4 deployment on an L1 testnet, ahead of the Ethereum mainnet
> target. Module-based Campaign architecture (host + delegatecall router
> + Sale/Collateral/Repayment modules) replaces the v3 monolith. GROW
> system (Token + Treasury + Minter + FeeSplitter + StakingPool) is wired
> in a separate broadcast on top.
>
> Seed campaigns: Olive Sicily ($0.144/CT, 350k maxCap), Vineyard of Etna
> ($0.10/CT, 500k maxCap), the Ecommerce Olive Shop demo, and a
> Split + Direct Issue smoke campaign. All are Active.
>
> Subgraph: served through the ugraph gateway. Direct legacy endpoints and
> the stale `prod` tag were removed; use
> `https://ugraph.growfi.dev/subgraphs/growfi-sepolia/latest/gn`.

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
| **SaleClassicModule** impl | [`0x4e11259078D5ef4DE008b563f43F87616f3Cf256`](https://sepolia.etherscan.io/address/0x4e11259078D5ef4DE008b563f43F87616f3Cf256) | Default auto-attached on every `createCampaign`. Enforces factory token policy, fixed-rate validation, isolated funding escrow, bounded sell-back accounting, buy/sellback/buyback/setMaxCap, and optional producer/promoter proceeds split routing. Existing seed campaigns were replaced to this impl on 2026-07-03. |
| **CollateralModule** impl | [`0xF2EAb14F7288E7d4E611C44F2784dfF6394ec476`](https://sepolia.etherscan.io/address/0xF2EAb14F7288E7d4E611C44F2784dfF6394ec476) | Default auto-attached. `lockCollateral`, `depositUSDC`, `settleSeasonShortfall`. |
| **RepaymentModule** impl | [`0xc3B052EA719b8BAe6AFb32bfe6b8D2B8fc2580D6`](https://sepolia.etherscan.io/address/0xc3B052EA719b8BAe6AFb32bfe6b8D2B8fc2580D6) | Whitelisted but NOT default. Producer attaches post-create. Refund = principal (from on-chain `pricePerToken`) + producer-set `bonusPerCt`. |
| **EcommerceModule** impl | [`0x4921f38F3D0de21057Ef202629D501E8b99d8616`](https://sepolia.etherscan.io/address/0x4921f38F3D0de21057Ef202629D501E8b99d8616) | Whitelisted but NOT default. Producer attaches post-create for SKU checkout. |
| **CampaignProceedsSplitModule** impl | [`0x989659D823011127af2757A7164Ff57f6daC9Bc7`](https://sepolia.etherscan.io/address/0x989659D823011127af2757A7164Ff57f6daC9Bc7) | Whitelisted but NOT default. Producer attaches post-create to split primary sale proceeds between producer and promoter, including 100% promoter routing. |
| **DirectIssueModule** impl | [`0x36cd3caB0c1b039dCB2B1BFba6bf926078f705A3`](https://sepolia.etherscan.io/address/0x36cd3caB0c1b039dCB2B1BFba6bf926078f705A3) | Whitelisted but NOT default. Producer attaches post-create to issue CampaignToken directly for off-chain agreements. |
| CampaignRegistry | [`0xAef1Cb97C9a8CC2d06d6C662F6655009DED1E1BE`](https://sepolia.etherscan.io/address/0xAef1Cb97C9a8CC2d06d6C662F6655009DED1E1BE) | `(campaign → metadataURI)` + monotonic version. |
| ProducerRegistry | [`0x52b30540174057756052F676Ed5Fd978E02b939b`](https://sepolia.etherscan.io/address/0x52b30540174057756052F676Ed5Fd978E02b939b) | Social attestation + producer-self-served profile. Deploy block `11163979`. |

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
| Split + Direct Issue Smoke | [`0x64E8CE3911646154E4e29D715C12b5B1b948D196`](https://sepolia.etherscan.io/address/0x64E8CE3911646154E4e29D715C12b5B1b948D196) | `SPLIT` | $0.144 |

### Frontend env (Sepolia ETH)

```ini
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_FACTORY_ADDRESS=0xa4DEd8Ab35e89bCAF1f7DFeb7aB2c1ED533b3f05
NEXT_PUBLIC_USDC_ADDRESS=0x32C344Dc9713d904442d0E5B0d2b7994E52B0d4E
NEXT_PUBLIC_USDT_ADDRESS=0x7c47aa550061117f8440128c6b829da5bf88de06
NEXT_PUBLIC_DAI_ADDRESS=0x3540ea8a6fa084a31321e790b89a6fbe677ae00e
NEXT_PUBLIC_REGISTRY_ADDRESS=0xAef1Cb97C9a8CC2d06d6C662F6655009DED1E1BE
NEXT_PUBLIC_PRODUCER_REGISTRY_ADDRESS=0x52b30540174057756052F676Ed5Fd978E02b939b
NEXT_PUBLIC_REPAYMENT_IMPL=0xc3B052EA719b8BAe6AFb32bfe6b8D2B8fc2580D6
NEXT_PUBLIC_ECOMMERCE_IMPL=0x4921f38F3D0de21057Ef202629D501E8b99d8616
NEXT_PUBLIC_DEBT_RESTRUCTURING_IMPL=
NEXT_PUBLIC_PROCEEDS_SPLIT_IMPL=0x989659D823011127af2757A7164Ff57f6daC9Bc7
NEXT_PUBLIC_DIRECT_ISSUE_IMPL=0x36cd3caB0c1b039dCB2B1BFba6bf926078f705A3
NEXT_PUBLIC_GROW_TOKEN=0x9bB4f9C41ed922282C181f2f3e01d8384c960b44
NEXT_PUBLIC_GROW_TREASURY=0xB71D13F80ceAed17A179B4e0D9eb1e8410DeaDDd
NEXT_PUBLIC_GROW_MINTER=0xD99c1985B257a4A55bA8D0836Fab536389cdd24C
NEXT_PUBLIC_GROW_FEE_SPLITTER=0xF1a8527E00916588f4Bb137cE450E8459b6BD436
NEXT_PUBLIC_GROW_STAKING_POOL=0xD1D8491370A8CF597bEcFc49D3253BfFAF34CDc8
NEXT_PUBLIC_SUBGRAPH_URL=https://ugraph.growfi.dev/subgraphs/growfi-sepolia/latest/gn
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
- No live Base Sepolia subgraph endpoint is retained. The active Ethereum Sepolia index is `https://ugraph.growfi.dev/subgraphs/growfi-sepolia/latest/gn`.

---

## Archived Base Sepolia `.env.local` (do not use for current localhost)

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
