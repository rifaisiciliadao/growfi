# GrowFi Admin

Separate wallet-gated Vite app for protocol operations. It is intended for
`admin.growfi.dev`, not for the public `growfi.dev` frontend.

The first supported operation is the mainnet FeeSplitter flush:

- connect an allowlisted admin wallet;
- read the FeeSplitter USDC balance and `previewFlush(USDC)`;
- submit `flushToken(USDC)` from the connected wallet.

There is no backend admin key and no private-key custody in this app. All writes
are wallet transactions.

## Local

```bash
cd platform/admin
npm install
npm run dev
```

Optional public environment variables are listed in `.env.example`.

## Deploy

The DigitalOcean App Platform spec defines this as a separate static site
component named `growfi-admin`. Route `admin.growfi.dev` to that component.
