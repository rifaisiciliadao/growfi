# GrowFi Subgraph

Indexes the GrowFi protocol on Ethereum Sepolia.

Canonical live endpoint:

```text
https://ugraph.growfi.dev/subgraphs/growfi/latest/gn
```

Direct legacy endpoints are no longer live and must not be used in app
configuration.

## Architecture

The subgraph starts from `CampaignFactory` and spawns dynamic templates for each
deployed campaign:

```text
CampaignFactory static data source
  -> CampaignCreated event
     -> Campaign template
     -> StakingVault template
     -> HarvestManager template
```

`ContractIndex` resolves `vault address -> Campaign` and
`harvestManager address -> Campaign` without expensive contract calls.

## Entities

- `Campaign` — aggregate campaign state.
- `AcceptedToken` — payment tokens configured per campaign.
- `Purchase` — campaign token purchases.
- `SellBackOrder` — sell-back queue rows.
- `Position` — individual staking positions.
- `Season` — season and harvest-report data.
- `Claim` — product or USDC redemptions by season/user.
- `YieldRateSnapshot` — yield-rate history.
- `User` — per-address aggregates.
- `GlobalStats` — protocol-wide aggregates.
- `ContractIndex` — reverse lookup for vault/harvest manager ownership.
- `Module`, `RepaymentPool`, `Repayment`, `EcommerceStore`, `EcommerceSku`,
  `EcommerceOrder` — v4 module surfaces.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run codegen` | Generate types from ABI files and schema |
| `npm run build` | Compile AssemblyScript handlers to WASM |
| `npm run prepare` | Run codegen and build |

Legacy provider CLI scripts were removed from `package.json` to avoid accidentally
deploying to a removed endpoint.

## Build

```bash
npm install
npm run prepare
```

See [DEPLOY.md](./DEPLOY.md) for live endpoint verification and indexer update
notes.
