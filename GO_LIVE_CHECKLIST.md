# GrowFi Go-Live Checklist

This checklist is the release gate for GrowFi. A release is not ready until every required item is completed on the target environment.

## Release Inputs

Record these values before running the final checks.

| Item | Value |
| --- | --- |
| Network |  |
| RPC endpoint |  |
| Deployer wallet |  |
| Multisig / owner wallet |  |
| GROW token address |  |
| Factory address |  |
| Campaign implementation address |  |
| Staking implementation address |  |
| UGraph endpoint |  |
| Frontend URL |  |
| Backend URL |  |

## Required Preflight

- The git worktree is clean.
- The release branch is merged into `main`.
- All secrets are stored in the deployment platform, not in the repository.
- `.env.example` files match the environment variables required by production services.
- `scripts/go-live-check.sh` passes locally.
- The same commit is deployed to frontend, backend, and indexer configuration.

For local dry runs during development, the gate can be narrowed without changing the script:

```sh
ALLOW_DIRTY=1 \
FOUNDRY_TEST_CMD='FOUNDRY_PROFILE=ci forge test --match-path test/AuditMitigations.t.sol' \
sh scripts/go-live-check.sh
```

For a release candidate, run the default full gate:

```sh
sh scripts/go-live-check.sh
```

## Smart Contracts

- Run the complete Foundry test suite.
- Run the specific regression tests for:
  - Factory token allowlist.
  - Campaign creation with disallowed tokens.
  - Allowance reset after transfers.
  - Stake position isolation.
  - Reward accounting across multiple stakes.
  - Claim, withdraw, and emergency paths.
- Verify that the factory only accepts approved campaign tokens.
- Verify that collateral and campaign reward assets are explicitly allowlisted.
- Verify that GROW is not required as the only collateral asset unless that risk is intentional and documented.
- Verify that owner/admin roles are assigned to the multisig or release owner wallet.
- Verify that no privileged role remains on a hot deployer wallet unless intentionally required.
- Verify that pause/emergency controls work and are restricted.
- Verify that upgrade permissions are restricted.
- Verify contracts on the block explorer.

## GROW Token Gate

- Confirm total supply, minting rules, and role assignments.
- Confirm whether minting is disabled, capped, or controlled by multisig.
- Confirm burn, pause, blacklist, transfer restriction, or tax behavior if present.
- Confirm that any tax or transfer hook cannot break campaign deposits, claims, or withdrawals.
- Confirm that the token cannot be used to bypass factory allowlists.
- Confirm that integrations use the token decimals correctly.

## Deployment

- Deploy contracts from a dedicated release wallet.
- Save deployed addresses in the repository deployment metadata or release notes.
- Set factory token allowlists before opening campaign creation.
- Set ownership and roles immediately after deployment.
- Run a test campaign on the target network.
- Create one campaign with an approved token.
- Attempt one campaign with a disallowed token and verify it reverts.
- Stake, claim, withdraw, and close the test campaign.
- Confirm all relevant events are emitted.

## Backend

- Run backend tests.
- Run backend typecheck or build.
- Verify production environment variables.
- Verify authentication and authorization.
- Verify rate limiting on public endpoints.
- Verify campaign creation cannot bypass contract allowlists.
- Verify API error responses for expected contract reverts.
- Run a production smoke test against the deployed backend.

## Frontend

- Run frontend tests.
- Run frontend typecheck or build.
- Verify wallet connection on the target network.
- Verify campaign creation, staking, claim, withdraw, and error states.
- Verify mobile layout for core flows.
- Verify legal, privacy, and risk copy if the app is public.
- Verify OpenGraph/social preview if the frontend is shared publicly.

## UGraph / Indexer

- Confirm GrowFi uses the private UGraph instance.
- Confirm only the authorized owner can deploy to this instance.
- Deploy the GrowFi subgraph from the release commit.
- Verify indexing starts from the correct block.
- Verify GraphQL endpoints return campaign, stake, claim, and withdrawal data.
- Verify reorg/retry logs are visible.
- Verify public query access is disabled if the instance is private.

## Go / No-Go

Go live only if all of these are true:

- Contract tests pass.
- Backend and frontend checks pass.
- Testnet or target-network smoke test passes end to end.
- Factory allowlist behavior is verified on-chain.
- Ownership and emergency controls are verified.
- UGraph indexing is live and querying the expected data.
- No unresolved high-severity security issue remains.

## Rollback Plan

- Pause campaign creation through the factory if a contract issue appears.
- Pause affected campaigns if the contracts support it.
- Disable frontend entry points for affected flows.
- Disable backend endpoints that can trigger affected actions.
- Keep UGraph running for post-incident analysis.
- Publish updated addresses only after the fix is deployed and verified.
