# GrowFi · Invite admin (local-only)

Mini React/Vite dashboard to manage the invite queue served by `platform/backend`.
Runs only on localhost. Don't deploy.

## Prereq

In `platform/backend/.env`:

```
ADMIN_API_KEY=<a-long-random-string>     # openssl rand -hex 24
RESEND_API_KEY=<resend key>              # optional in dev (logs emails to stdout otherwise)
RESEND_FROM=GrowFi <hello@yourdomain.com>
APP_URL=http://localhost:3000
```

## Run

```bash
# 1. Backend (terminal A)
cd platform/backend
npm run dev      # listens on :4001

# 2. Admin dashboard (terminal B)
cd platform/admin
npm install
npm run dev      # opens http://127.0.0.1:4101
```

The Vite dev server proxies `/api/*` to `http://localhost:4001` (override with
`VITE_BACKEND_URL=...`). On first load you paste the `ADMIN_API_KEY`; it is
kept only in `localStorage`.

## Endpoints used (under `X-Admin-Key`)

- `GET  /api/admin/invites?status=pending|approved|rejected|all`
- `POST /api/admin/invites/:id/approve` — generates code, sends approved email
- `POST /api/admin/invites/:id/reject`  body `{ notes?, notify? }`
- `DELETE /api/admin/invites/:id`
