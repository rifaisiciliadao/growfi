# GrowFi

**Regenerative finance protocol for fractionalized agricultural production.**

GrowFi lets producers raise capital from a crowd of investors, who in turn receive a tokenized claim on the seasonal harvest — redeemable as physical product (e.g. olive oil) or as USDC. Each campaign is a self-contained set of contracts deployed by the protocol factory, with a deflationary equity token, dynamic-yield staking, seasonal harvest reporting, and a sell-back queue for secondary-market liquidity.

The first production use case is extra-virgin olive oil in Sicily, but the protocol is commodity-agnostic and chain-agnostic.

---

## How it works

```
┌───────────────────────┐       ┌───────────────────────────┐
│   CampaignFactory     │──────▶│       Campaign            │
│   (protocol registry) │       │   (sales, escrow,         │
└───────────────────────┘       │    sell-back, buyback)    │
                                 └────────────┬──────────────┘
                                              │ mints/burns
                                              ▼
                                 ┌───────────────────────────┐
                                 │     CampaignToken         │
                                 │   "The Seat" — ERC20Votes │
                                 └────────────┬──────────────┘
                                              │ staked into
                                              ▼
                                 ┌───────────────────────────┐
                                 │     StakingVault          │
                                 │  dynamic 1–5×/day yield   │
                                 │  multi-position, seasonal │
                                 └────────────┬──────────────┘
                                              │ mints
                                              ▼
                                 ┌───────────────────────────┐
                                 │       YieldToken          │
                                 │   "The Fruit" — ERC20     │
                                 └────────────┬──────────────┘
                                              │ burned for redemption
                                              ▼
                                 ┌───────────────────────────┐
                                 │     HarvestManager        │
                                 │  Merkle product claims +  │
                                 │  pro-rata USDC claims     │
                                 └───────────────────────────┘
```

### Lifecycle

1. **Funding** — Producer is onboarded by the protocol owner via `CampaignFactory.createCampaign(...)`. The factory deploys the full contract suite and wires circular dependencies through setter functions. Investors buy `$CAMPAIGN` tokens with any whitelisted payment token (fixed-rate, e.g. USDC, or Chainlink oracle-priced, e.g. WETH). Funds sit in escrow on the `Campaign` contract. Each buyer's payment is tracked per token for refund purposes.
2. **Activation** — As soon as `minCap` is reached, the campaign auto-activates: escrowed funds are released to the producer (minus a 2 % protocol fee), and the campaign enters the `Active` state.
3. **Failure → Buyback** — If `minCap` is not reached by `fundingDeadline`, anyone can trigger `Buyback`. Each investor can reclaim their exact original payment (per token) by burning their proportional `$CAMPAIGN`.
4. **Staking & seasons** — In the `Active` state the producer calls `startSeason(id)`. Holders stake `$CAMPAIGN` to earn `$YIELD`. The yield rate is **dynamic**: 5 `$YIELD/token/day` at 0 % vault fill, linearly decaying to 1 at 100 % fill (Synthetix-style O(1) accumulator). Unstaking before the end of the season incurs a linear penalty (tokens burned). Each stake creates an independent position (up to 50 per user, compactable).
5. **Sell-back queue** — Active holders can deposit `$CAMPAIGN` into a FIFO sell-back queue. New buyers automatically fill the queue first — supply stays flat (burn + mint net zero), and the seller receives the buyer's payment token at the same price.
6. **Harvest reporting** — At the end of each season the producer calls `reportHarvest(seasonId, valueUSD, merkleRoot, productUnits)`. The contract snapshots the total `$YIELD` supply and opens a 30-day claim window plus a 90-day USDC deposit window. 2 % protocol fee is deducted. Holders can either burn `$YIELD` for physical product (verified against the Merkle root) or for a pro-rata share of the USDC pool.
7. **Redemption** — Product redemption requires a valid Merkle proof of `(holder, seasonId, productAmount)` and enforces a minimum claim (e.g. 5 L). USDC claims are pro-rata against the producer's deposits — can be called repeatedly as the producer deposits more. After the deposit window closes the remaining USDC obligation is frozen.
8. **Next season** — Positions can be `restake`d into the next season (yield from the previous season is auto-claimed at restake). Unstake after the full season returns principal with no penalty.

---

## Contracts

| Contract | Role |
|---|---|
| `CampaignFactory.sol` | Owner-gated deployer & registry. Emergency pause/unpause per campaign. |
| `Campaign.sol` | Token sales, escrow, activation, buyback refunds, sell-back queue. |
| `CampaignToken.sol` | ERC20 + Permit + Votes. Mint gated to `Campaign`; burn to `Campaign` + `StakingVault` (penalties). |
| `StakingVault.sol` | Seasonal staking with multi-position, linear early-exit penalty, Synthetix accumulator. |
| `YieldToken.sol` | ERC20. Mint gated to `StakingVault`; burn to `StakingVault` + `HarvestManager`. |
| `HarvestManager.sol` | Harvest reporting, Merkle-based product redemption, pro-rata USDC redemption, producer deposit window. |

All contracts are Solidity 0.8.24, built against OpenZeppelin v5, compiled with `via_ir` and optimizer runs 200.

---

## Security

- **Access control** — every mint/burn and privileged function is gated by a concrete caller role (`OnlyCampaign`, `OnlyProducer`, `OnlyFactory`, `OnlyVaultOrHarvest`, …). Setter functions enforce one-time wiring.
- **ReentrancyGuard + Pausable** on every state-changing external function.
- **Oracle safety** — `latestRoundData` is validated for non-negative price, non-stale (`updatedAt` within 1 h) and `decimals ≤ 18` before being normalized.
- **Escrow isolation** — funding-phase payments sit in the Campaign contract; only `_activate()` (on min-cap success) or `buyback()` (on failure) can move them.
- **No admin withdrawal** on campaign escrows. No upgrade proxy. No rescue function.
- **2 % protocol fee** is taken on activation and on harvest report; never on post-activation secondary-market buys.

### Test suite (107 tests, all green)

| Suite | Tests | Purpose |
|---|---|---|
| `AuditTest` | 6 | Regression tests for issues surfaced during internal audit. |
| `CampaignTokenTest` | 7 | ERC20 + Votes + access control. |
| `YieldTokenTest` | 5 | ERC20 + mint/burn gating. |
| `SecurityTest` | 15 | Targeted security-surface coverage. |
| `IntegrationTest` | 5 | Happy-path multi-contract flows. |
| `E2ETest` | 1 | Ten-phase full-lifecycle simulation with multi-investor, multi-token, multi-season, real Merkle tree, pro-rata USDC deposits. |
| `RedTeamTest` | 39 | Adversarial attack attempts across every surface: forged Merkle proofs, oracle manipulation, unauthorized mint/burn, double-redemption, season replay, factory setter re-hijack, pause bypass, escrow drain, max-cap bypass, MEV-style sell-back gaming, USDC deadline bypass, griefing with max positions, dust-redemption, etc. Each passing test is a blocked exploit. |
| `FuzzTest` | 8 | Property-based tests (256 runs each, ~2k random inputs): buyback refund exactness, maxCap bound, sell-back supply preservation, unstake penalty monotonicity, yield linearity in stake amount, USDC pro-rata with partial deposits, escrow sums, purchased-tokens accounting. |
| `InvariantsTest` | 9 | Stateful fuzzing via Handler pattern (64 runs × 50 depth = ~28k random calls per run). Global invariants checked after every action: vault balance == totalStaked, sum(active positions) == totalStaked, currentSupply ≥ totalSupply with burn accounting, sum(pendingSellBack) == queue depth, escrow == sum(purchases) in Funding, campaign holds ≥ queued sell-back, currentSupply ≤ maxCap, state monotonic. |
| `GasBoundsTest` | 3 | DoS-resistance tests. Enforces the `MAX_ACCEPTED_TOKENS = 10` cap on payment-token whitelist, and verifies that activation with a full whitelist stays under a 1M-gas budget. |
| `ForkMainnetTest` | 3 | Fork against Ethereum mainnet using real USDC (0xA0b8…EB48) and real Chainlink ETH/USD feed (0x5f4e…8419). Full buy + lifecycle + oracle price check. |
| `ForkBaseMainnetTest` | 3 | Same test battery against Base mainnet native USDC (0x8335…2913) and Chainlink ETH/USD (0x7104…Bb70). |
| `ForkArbitrumTest` | 3 | Same test battery against Arbitrum One native USDC (0xaf88…5831) and Chainlink ETH/USD (0x639F…a612). |

Run `forge test --summary` to see the full matrix.

---

## Internal audit report

This is the protocol's self-conducted security review. It is **not a substitute** for a third-party audit, but it documents every finding, fix, and defensive control baked into the codebase today.

### Methodology

1. **Threat modeling** — enumerated every privileged role (`producer`, `factory`, `owner`, `stakingVault`, `harvestManager`) and every state-mutating entry point on each contract. For each, asked: who can call this, under what state, and what invariants must hold before/after.
2. **Line-by-line review** — two passes over all six contracts, focused on arithmetic safety, reentrancy surfaces, oracle trust, Merkle trust, ERC20 quirks (fee-on-transfer, proxy, non-standard return values via `SafeERC20`), and state-machine transitions.
3. **Adversarial testing** — wrote `RedTeamTest` (39 attack scenarios) where each test is an exploit attempt. A green test = a blocked exploit.
4. **Property-based testing** — `FuzzTest` (8 properties × 256 runs) for precision loss and monotonicity; `InvariantsTest` (9 stateful invariants × 64 runs × 50 depth ≈ 28k random calls per invariant) via Handler pattern.
5. **Gas/DoS review** — audited every loop for unbounded iteration. Added `MAX_ACCEPTED_TOKENS = 10` cap on the single unbounded loop found (`_activate` over `acceptedTokenList`).
6. **Real-chain validation** — fork tests on Ethereum, Base, and Arbitrum mainnets with the real USDC contracts (each chain's native USDC has a different proxy layout) and real Chainlink ETH/USD feeds to confirm behavior under production-grade ERC20/oracle contracts.

### Findings and fixes

Tracked across internal review iterations and captured as regression tests in `AuditTest` and `SecurityTest`.

| # | Severity | Area | Finding | Fix | Test |
|---|---|---|---|---|---|
| 1 | Critical | `StakingVault` | Yield accrual could leak across seasons if a position's accumulator was not snapshotted at season end, allowing silent claims against the next season's pool. | Season struct stores `rewardPerTokenAtEnd`; `_earned` caps at that snapshot when the position's season has ended. | `test_noYieldLeakAcrossSeasons` |
| 2 | Critical | `Campaign` | Buyback refund burned *all* of a user's `$CAMPAIGN`, including tokens purchased after activation via the secondary market. Could be gamed to extract funds that weren't paid into escrow. | Track `purchasedTokens[user][paymentToken]` and only burn that amount on `buyback()`. | `test_buybackOnFailedCampaign`, red-team #10 |
| 3 | Critical | `HarvestManager` | Double-redemption possible — a user could redeem for product, then redeem for USDC in the same season. | Single-entry `Claim` struct with `claimed` flag, checked before any redemption path. | red-team #7 |
| 4 | High | `StakingVault` | Restake in the same season would reset `startTime` and `rewardPerTokenPaid`, effectively stealing additional yield. | `RestakeSameSeason` revert when `pos.seasonId == currentSeasonId`. | `test_cannotRestakeSameSeason`, red-team #28 |
| 5 | High | `StakingVault` | Season IDs could be reused after ending, allowing replay of a completed season's yield accumulator. | `SeasonAlreadyUsed` revert when `seasons[seasonId].existed`. | `test_cannotReuseSeasonId`, red-team #15 |
| 6 | Medium | `Campaign` | `fixedRate` could be set to zero in `addAcceptedToken` with `PricingMode.Fixed`, causing division-by-zero on the next buy. | Explicit `require(fixedRate > 0)` on fixed mode; explicit `require(oracleFeed != address(0))` on oracle mode. | red-team #25 |
| 7 | Medium | `Campaign` | Oracle with more than 18 decimals would overflow the `10 ** (18 - decimals)` normalization. | Hard require `decimals ≤ 18`. | red-team #35 |
| 8 | Medium | `HarvestManager` | Dust redemption could fragment the product pool (1-liter claims against an olive-oil harvest). | `minProductClaim` per campaign, enforced before Merkle verification. | red-team #37 |
| 9 | Medium | `Campaign` | Sell-back order cancellation wouldn't decrement `pendingSellBack` correctly if the same user had multiple orders, enabling over-cancellation. | Per-user `userSellBackIndices` array, cleared atomically on cancel. | `test_sellBackQueue`, red-team #21 |
| 10 | Medium | `StakingVault` | A user could grief the `userPositionIds` array by opening many tiny stakes, bloating everyone's iteration cost. | Per-user `MAX_POSITIONS_PER_USER = 50` cap; `compactPositions()` as a self-help lever. | red-team #36 |
| 11 | Medium | `CampaignFactory` | `setProtocolFeeRecipient(address(0))` would silently break fee distribution. | Explicit zero-address revert. | `test_cannotSetZeroFeeRecipient` |
| 12 | Medium | `Campaign` | Gas DoS: `acceptedTokenList` was unbounded; a producer adding N payment tokens would make `_activate()` grow linearly, and could eventually exceed the block gas limit. | Hard cap `MAX_ACCEPTED_TOKENS = 10`; activation gas budget verified under 1M on full list. | `GasBoundsTest` |
| 13 | Low | `HarvestManager` | Producer could theoretically deposit USDC after the 90-day window closed, wasting funds. | `DepositWindowClosed` revert past `usdcDeadline`. | red-team #9 |
| 14 | Low | `HarvestManager` | Partial producer deposits could let early claimants drain the pool proportional to deposit-at-time-of-claim; needed to be made idempotent. | `claim.usdcClaimed` tracks cumulative claim; `claimUSDC()` transfers only `entitlement - alreadyClaimed`, supports re-calling as more USDC is deposited. | `test_usdcMultiClaim` |

### Invariants verified (stateful fuzzing)

Across ~28k random action sequences per invariant, all held:

- `campaignToken.balanceOf(stakingVault) == stakingVault.totalStaked()` — vault never holds more or less than the accounted stake.
- `sum(active positions' amounts) == totalStaked` — position accounting stays consistent with the aggregate.
- `campaign.currentSupply() ≥ campaignToken.totalSupply()`, and the delta equals the cumulative burned amount across penalties and buybacks — no silent mint/burn path.
- `sum(pendingSellBack[user]) == getSellBackQueueDepth()` — queue bookkeeping is consistent with per-user ledger.
- `campaignToken.balanceOf(campaign) ≥ queueDepth` — the campaign contract always has at least the queued tokens it's custodying.
- During `Funding`: `usdc.balanceOf(campaign) == sum(purchases[user][usdc])` — escrow balance is explained entirely by tracked purchases.
- `currentSupply ≤ maxCap` — never exceeded.
- State transitions are monotonic — once past `Funding`, never returns to `Funding`.

### Properties verified (fuzz)

- Buyback refund is exactly equal to the payment made — zero slippage, zero rounding loss.
- Sell-back fills preserve total supply (burn + mint net zero on the filled portion).
- Unstake penalty is linear and monotonic in time: more time staked → strictly more returned.
- Yield earned scales linearly with stake amount at the same rate (proves the accumulator math).
- Pro-rata USDC claims match `aliceOwed × depositedBps / 10_000` under partial deposits.

### Explicit non-guarantees

- **Rebasing / fee-on-transfer payment tokens** are not supported. The whitelist expects standard-behavior ERC20s. Adding such a token would break the buyback accounting. Producers must not whitelist them.
- **Chainlink feed heartbeat** is enforced as 1 hour. Feeds with longer heartbeats (some rare L2 feeds) would fail `StaleOraclePrice` spuriously. Choose feeds with ≤1h heartbeat.
- **Merkle tree construction** happens off-chain. If the producer publishes a malicious root, holders get the product allocation that root encodes. The protocol cannot validate that the root is fair — only that the producer signed it.
- **USDC decimals** are assumed to be 6 globally. This holds on Ethereum, Base, and Arbitrum (all Circle native USDC) but would break on chains where USDC has other decimals.

---

## Usage

```bash
# Install dependencies
forge install

# Build
forge build

# Run full test suite
forge test

# Run a specific attack scenario
forge test --match-test test_attack_forgeMerkleProof -vvv

# Format
forge fmt

# Gas snapshot
forge snapshot
```

Deployment script lives at `script/Deploy.s.sol`.

---

## Status

- Smart contracts implemented and tested: **107/107 passing** (unit + integration + E2E + adversarial + fuzz + stateful invariants + gas-bounds + multi-chain fork tests).
- Internal security review: complete (fixes merged).
- External audit: **pending**. Do not deploy to mainnet until audit is finalized.
- Fork tests pass against Ethereum, Base, and Arbitrum mainnet (real USDC + real Chainlink ETH/USD feeds).
- Subgraph / indexer: out of scope of this repo (see event specs in `Campaign.sol`, `StakingVault.sol`, `HarvestManager.sol`).

---

## License

MIT — see [LICENSE](./LICENSE).
