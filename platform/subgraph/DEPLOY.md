# GrowFi Subgraph

## Live Endpoint

The app uses the ugraph gateway:

```text
https://ugraph.growfi.dev/subgraphs/growfi/latest/gn
```

The versioned ugraph route is also available:

```text
https://ugraph.growfi.dev/subgraphs/growfi/4.0.3/gn
```

Direct legacy provider URLs and the old `prod` tag were removed. Do not put
legacy direct endpoints in frontend, backend, DigitalOcean, or local env files.

## Indexed Deployment

| Parameter | Value |
|-----------|-------|
| Chain | Ethereum Sepolia (id 11155111) |
| Factory | [`0xa4DEd8Ab35e89bCAF1f7DFeb7aB2c1ED533b3f05`](https://sepolia.etherscan.io/address/0xa4DEd8Ab35e89bCAF1f7DFeb7aB2c1ED533b3f05) |
| Start block | `10838711` |

The full address set is in `subgraph.yaml` and the root `CONTRACTS.md`.

## Build

```bash
cd platform/subgraph
npm install
npm run prepare
```

`npm run prepare` runs codegen and compiles the AssemblyScript handlers to
`build/`.

## Verify

Check the live endpoint after any indexer or gateway change:

```bash
curl -sS https://ugraph.growfi.dev/subgraphs/growfi/latest/gn \
  -H 'content-type: application/json' \
  --data '{"query":"query Health { _meta { block { number hash } hasIndexingErrors } globalStats(id: \"0x676c6f62616c\") { campaignCount userCount totalRaised totalStakers } }"}'
```

Expected:

- HTTP `200`
- `_meta.hasIndexingErrors: false`
- non-null `globalStats`

## Updating The Indexer

1. Update `subgraph.yaml` addresses and start blocks.
2. Re-extract ABI JSON files if contracts changed.
3. Bump `package.json` version when the schema or handlers change.
4. Run `npm run prepare`.
5. Deploy through the current ugraph/indexer infrastructure, then verify the
   `latest` endpoint above.

Legacy provider CLI scripts were removed from `package.json` to avoid accidentally
deploying to a removed endpoint.
