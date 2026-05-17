# GrowFi Subgraph

Indicizza il protocollo GrowFi su **Arbitrum Sepolia** (testnet). Hosted su **Goldsky**, team **turinglabs**.

## Architettura

Il subgraph parte da `CampaignFactory` e spawna dinamicamente template per ogni campagna deployata:

```
CampaignFactory (data source statica)
  └─ CampaignCreated event
     ├─ Campaign template       → listens on dynamic Campaign contract
     ├─ StakingVault template   → listens on dynamic StakingVault
     └─ HarvestManager template → listens on dynamic HarvestManager
```

Un `ContractIndex` risolve `vault address → Campaign` e `harvestManager address → Campaign` in O(1) senza contract call costose.

## Entities

- **Campaign** — stato campagna aggregato (supply, state, yield rate, totalStaked)
- **AcceptedToken** — token pagamento configurati sulla campagna
- **Purchase** — ogni acquisto di $CAMPAIGN token
- **SellBackOrder** — code di sell-back
- **Position** — posizioni staking individuali
- **Season** — stagioni + dati harvest report
- **Claim** — riscatti (prodotto o USDC) per stagione/user
- **YieldRateSnapshot** — serie storica del yield rate
- **User** — aggregati per indirizzo utente
- **GlobalStats** — aggregati di protocollo
- **ContractIndex** — lookup inverso vault/harvest → campaign

## Script

| Command | Description |
|---------|-------------|
| `npm run codegen` | Generate types from ABI files + schema |
| `npm run build` | Compile AssemblyScript handlers to WASM |
| `npm run prepare` | codegen + build |
| `npm run goldsky:login` | Login CLI Goldsky |
| `npm run deploy:goldsky` | Deploy `growfi/<version>` |
| `npm run deploy:goldsky:prod` | Deploy + tag as `prod`; do not use unless explicitly requested |
| `npm run deploy:goldsky:promote` | Tag the current version as `prod`; do not use unless explicitly requested |
| `npm run goldsky:logs` | Live log indexer |
| `npm run goldsky:list` | List team subgraphs |

## Deploy

Vedi [DEPLOY.md](./DEPLOY.md) per le istruzioni passo-passo.

**TL;DR:**
```bash
# 1. Aggiorna subgraph.yaml con factory address + startBlock
# 2. Login
npm run goldsky:login
# 3. Build + deploy
npm run prepare
npm run deploy:goldsky:prod
```
