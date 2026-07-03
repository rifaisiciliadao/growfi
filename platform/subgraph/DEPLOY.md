# GrowFi Subgraph

## Live Endpoint

The apps use the ugraph gateway:

```text
Mainnet: https://ugraph.growfi.dev/subgraphs/growfi/latest/gn
Sepolia: https://ugraph.growfi.dev/subgraphs/growfi-sepolia/latest/gn
```

Direct legacy provider URLs and the old `prod` tag were removed. Do not put
legacy direct endpoints in frontend, backend, DigitalOcean, or local env files.

## Indexed Deployment

| Network | Manifest | Factory | Start block |
|---|---|---|---:|
| Ethereum Mainnet (id 1) | `subgraph.yaml` | `0x81c2ecb09B8062cC9F3A4F8682318456304f4aE2` | `25328624` |
| Ethereum Sepolia (id 11155111) | `subgraph.sepolia.yaml` | `0xa4DEd8Ab35e89bCAF1f7DFeb7aB2c1ED533b3f05` | `10838711` |

The full address set is in `subgraph.yaml` and the root `CONTRACTS.md`.

## Build

```bash
cd platform/subgraph
npm install
npm run prepare:sepolia
```

Use `prepare:mainnet` or `prepare:sepolia` for the target network. Both run
codegen and compile the AssemblyScript handlers to `build/`.

## Verify

Check the live endpoint after any indexer or gateway change:

```bash
curl -sS https://ugraph.growfi.dev/subgraphs/growfi/latest/gn \
  -H 'content-type: application/json' \
  --data '{"query":"query Health { _meta { block { number hash } hasIndexingErrors } globalStats(id: \"0x676c6f62616c\") { campaignCount userCount totalRaised totalStakers } }"}'
```

For Sepolia, use:

```bash
curl -sS https://ugraph.growfi.dev/subgraphs/growfi-sepolia/latest/gn \
  -H 'content-type: application/json' \
  --data '{"query":"query Health { _meta { block { number hash } hasIndexingErrors } globalStats(id: \"0x676c6f62616c\") { campaignCount userCount totalRaised totalStakers } }"}'
```

Expected:

- HTTP `200`
- `_meta.hasIndexingErrors: false`
- non-null `globalStats`

## Updating The Indexer

1. Update the target manifest addresses and start blocks.
   Mainnet uses `subgraph.yaml`; Sepolia uses `subgraph.sepolia.yaml`.
2. Re-extract ABI JSON files if contracts changed.
3. Bump `package.json` version when the schema or handlers change.
4. Run `npm run prepare:mainnet` or `npm run prepare:sepolia`.
5. Deploy only the target ugraph/indexer deployment, then verify the matching
   `latest` endpoint above.

Legacy provider CLI scripts were removed from `package.json` to avoid accidentally
deploying to a removed endpoint.
