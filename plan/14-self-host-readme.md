# 14 — Self-host README & Docker

## Goal

Make Prism trivially self-hostable: a comprehensive README, a working `docker-compose.yml` (Postgres + app via `adapter-node`), a one-shot `bin/setup.sh`, and a `wrangler.toml` for the Cloudflare path. After this step a stranger can clone the repo, fill in `.env`, run two commands, and have a working instance.

## Touches

- `README.md` — full rewrite.
- `Dockerfile` — multi-stage build for `adapter-node`.
- `docker-compose.yml` — `postgres`, `app`, optional `mailcatcher`.
- `bin/setup.sh` — one-shot bootstrap (creates DB, runs migrations, seeds packs).
- `wrangler.toml` — Cloudflare bindings (R2, KV, Hyperdrive).
- `.dockerignore`.
- `.env.example` — final consolidated form.

## Reuses

- `adapter-node` build path from step 00 (`BUILD_TARGET=node`).
- All migration / seed scripts already in [`package.json`](../package.json).

## `.env.example` (final, consolidated)

```bash
# --- Core ---
ORIGIN="http://localhost:3000"
PUBLIC_APP_NAME="Prism"
DATABASE_URL="postgres://prism:prism@localhost:5432/prism"
BETTER_AUTH_SECRET=""        # 32+ random chars; `openssl rand -hex 32`

# --- Auth providers (optional) ---
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# --- OpenRouter ---
OPENROUTER_API_KEY=""
OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"

# --- Storage ---
STORAGE_DRIVER="s3"          # s3 | r2 (workers binding)
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET="prism"
R2_ENDPOINT=""               # https://<account>.r2.cloudflarestorage.com
R2_PUBLIC_BASE_URL=""        # optional CDN

# --- Email (Resend or SMTP) ---
RESEND_API_KEY=""
SMTP_URL=""                  # smtp://user:pass@host:587 (used if RESEND_API_KEY unset)
EMAIL_FROM="Prism <noreply@prism.example>"

# --- Stripe ---
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PUBLIC_KEY=""

# --- Tokens ---
DAILY_ALLOWANCE_TOKENS="10"

# --- Ads (optional) ---
PUBLIC_ADSENSE_CLIENT_ID=""
PUBLIC_ADSENSE_SLOT_LIBRARY_TOP=""
PUBLIC_ADSENSE_SLOT_LANDING_FOOTER=""

# --- Rate limit / abuse ---
RATE_LIMIT_ANON="60/m"
RATE_LIMIT_USER="600/h"
MODERATION_MODEL="openai/omni-moderation-latest"

# --- Observability ---
LOG_LEVEL="info"
SENTRY_DSN=""
METRICS_TOKEN=""
```

## README outline

```
# Prism

Black-and-white, monospace, token-based AI image generator.

## Demo
[link]

## Features
- Generate via any OpenRouter image model
- Library, reference uploads, batch up to 4
- Stripe Checkout, free daily allowance
- GDPR-grade consent, DSAR export, account delete
- Self-hostable on Cloudflare Workers OR Docker

## Quick start (Docker)
1. `git clone …`
2. `cp .env.example .env`  → fill in secrets
3. `docker compose up -d`
4. `docker compose exec app npm run db:migrate`
5. Open http://localhost:3000

## Quick start (Cloudflare)
1. Create R2 bucket, KV namespace, Hyperdrive config pointing at your Postgres
2. `cp .env.example .env`, edit `wrangler.toml` to bind them
3. `npx wrangler deploy`
4. `npm run db:migrate`

## Tech stack
SvelteKit 2 · Svelte 5 · Tailwind 4 · Drizzle · Postgres · Better Auth · OpenRouter · R2 · Stripe · Resend

## Configuration
[Env table — copy from .env.example with one-line descriptions]

## Customising
- Pack catalogue: `src/lib/server/tokens/packs.ts`
- Model whitelist (deny specific OpenRouter models): `src/lib/server/openrouter/registry.ts`
- Cost-per-token rate: `USD_PER_TOKEN` in `pricing.ts`
- Daily allowance: `DAILY_ALLOWANCE_TOKENS`
- Branding: `src/routes/+layout.svelte`, `static/`, `PUBLIC_APP_NAME`

## Development
[Dev commands]

## Architecture
[Short tour of `src/lib/server/*` and the SSE pipeline]

## Self-hosting checklist
- [ ] Set `BETTER_AUTH_SECRET`
- [ ] Configure SMTP or Resend
- [ ] Configure R2/S3 bucket and CORS
- [ ] Add Stripe products (run `npm run stripe:sync`)
- [ ] Configure AdSense (optional)
- [ ] Set up Stripe webhook → /api/webhooks/stripe
- [ ] Verify /api/healthz returns 200

## License
[Choose: MIT? AGPL? — user to confirm]
```

## Steps

1. Write the `Dockerfile`:

   ```dockerfile
   FROM node:22-alpine AS build
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN BUILD_TARGET=node npm run build:node && npm prune --omit=dev

   FROM node:22-alpine
   WORKDIR /app
   COPY --from=build /app/build ./build
   COPY --from=build /app/node_modules ./node_modules
   COPY --from=build /app/package.json ./
   COPY --from=build /app/drizzle ./drizzle
   ENV NODE_ENV=production
   EXPOSE 3000
   CMD ["node", "build"]
   ```

2. `docker-compose.yml`:

   ```yaml
   services:
     postgres:
       image: postgres:17-alpine
       environment: { POSTGRES_USER: prism, POSTGRES_PASSWORD: prism, POSTGRES_DB: prism }
       volumes: ['postgres_data:/var/lib/postgresql/data']
       healthcheck: { test: ['CMD', 'pg_isready', '-U', 'prism'], interval: 5s }
     app:
       build: .
       env_file: .env
       ports: ['3000:3000']
       depends_on:
         postgres: { condition: service_healthy }
     mailcatcher:
       image: dockage/mailcatcher
       ports: ['1080:1080', '1025:1025']
       profiles: ['dev']
   volumes: { postgres_data: {} }
   ```

3. `bin/setup.sh`:

   ```bash
   #!/usr/bin/env sh
   set -e
   docker compose up -d postgres
   docker compose run --rm app npm run db:migrate
   docker compose run --rm app npm run db:seed
   docker compose up -d app
   echo "Prism is running at $ORIGIN"
   ```

4. `wrangler.toml`:

   ```toml
   name = "prism"
   main = ".svelte-kit/cloudflare/_worker.js"
   compatibility_date = "2026-05-01"
   [[r2_buckets]]
   binding = "R2"
   bucket_name = "prism"
   [[kv_namespaces]]
   binding = "RATE_LIMIT"
   id = "<replace>"
   [[kv_namespaces]]
   binding = "MODEL_CACHE"
   id = "<replace>"
   [[hyperdrive]]
   binding = "DB"
   id = "<replace>"
   ```

5. `.dockerignore`: `node_modules`, `.svelte-kit`, `build`, `.git`, `e2e/test-results`.
6. Add a CI workflow stub (`.github/workflows/ci.yml`) running `npm run check`, unit, e2e, and a `docker build` smoke. (Optional but tested below.)

## Tests

`e2e/self-host-smoke.test.ts` (slow; tagged `@docker`):

```ts
test('docker compose up reaches /healthz', async () => {
	await sh('docker compose up -d --build');
	await waitFor(() => fetch('http://localhost:3000/api/healthz').then((r) => r.ok), 60_000);
	await sh('docker compose down -v');
});
```

`bin/setup.sh` — bash-syntax check via `shellcheck` in CI.

Manual checklist (in README): 6-step "first run" walkthrough that exercises signup → daily allowance → generate → buy pack → library → delete account.

## Verify

```bash
shellcheck bin/setup.sh
docker build -t prism:smoke .
docker compose up -d
curl -fsS http://localhost:3000/api/healthz | jq
docker compose down -v
```

Acceptance: a fresh clone with only Docker installed reproduces the v1 acceptance flow from the meta-plan; the README has zero "TODO" markers; `wrangler deploy` succeeds against a configured Cloudflare account; CI smoke job stays green.
