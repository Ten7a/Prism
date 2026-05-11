# Prism

Black-and-white, monospace, token-based AI image generator.
SvelteKit + Postgres + OpenRouter + R2/S3, deployable to Cloudflare Workers or any Docker host.

## Features

- Generate via any OpenRouter image model (per-model pricing surfaced in tokens)
- Library, reference uploads, batch up to 4 images per run, SSE-streamed previews
- Stripe Checkout + customer portal + free daily token allowance
- GDPR-grade consent banner, DSAR export, account deletion
- Self-hostable on Cloudflare Workers (R2 + KV + Hyperdrive) **or** Docker
  (Postgres + Node)

## Quick start (Docker)

Requires Docker and Docker Compose.

```bash
git clone <this repo>
cd prism
cp .env.example .env          # fill OPENROUTER_API_KEY at minimum
bin/setup.sh                  # generates BETTER_AUTH_SECRET, brings up everything
```

Open <http://localhost:3000>.

What `bin/setup.sh` does:

1. Copies `.env.example` → `.env` if missing.
2. Generates `BETTER_AUTH_SECRET` via `openssl rand -hex 32` if blank.
3. `docker compose up -d postgres`.
4. `docker compose run --rm app npm run db:migrate` then `npm run db:seed`.
5. `docker compose up -d app`.

Optional dev mailcatcher (captures outbound email at <http://localhost:1080>):

```bash
docker compose --profile dev up -d mailcatcher
```

## Quick start (Cloudflare)

1. Create an R2 bucket, two KV namespaces (`RATE_LIMIT`, `MODEL_CACHE`), and a
   Hyperdrive config pointing at your Postgres.
2. Edit `wrangler.toml` and replace the `<replace-with-…>` IDs.
3. `cp .env.example .env` and fill in secrets (used as Worker vars on deploy).
4. `npx wrangler deploy`.
5. `npm run db:migrate` against the same Postgres.

## Tech stack

SvelteKit 2 · Svelte 5 · Tailwind 4 · Drizzle · Postgres · Better Auth ·
OpenRouter · R2 (or any S3) · Stripe · Resend / SMTP

## Configuration

All configuration is via environment variables. See `.env.example` for the full
list. The most important:

| Variable                                      | Required                | Notes                                           |
| --------------------------------------------- | ----------------------- | ----------------------------------------------- |
| `DATABASE_URL`                                | yes                     | `postgres://…`                                  |
| `BETTER_AUTH_SECRET`                          | yes                     | 32+ random chars; `openssl rand -hex 32`        |
| `ORIGIN`                                      | yes                     | Public origin URL, e.g. `https://prism.example` |
| `OPENROUTER_API_KEY`                          | yes                     | From <https://openrouter.ai>                    |
| `STORAGE_DRIVER`                              | yes                     | `s3` (HTTP) or `r2` (Workers binding)           |
| `R2_*`                                        | if `s3`                 | Bucket, endpoint, access keys                   |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | for paid packs          |                                                 |
| `RESEND_API_KEY` or `SMTP_URL`                | for transactional email |                                                 |
| `DAILY_ALLOWANCE_TOKENS`                      | no                      | default `10`                                    |
| `RATE_LIMIT_*`                                | no                      | token-bucket spec like `60/m`, `200/h`          |
| `MODERATION_MODEL`                            | no                      | OpenRouter model id; empty disables             |
| `SENTRY_DSN`                                  | no                      | server-side error reporting                     |
| `METRICS_TOKEN`                               | no                      | bearer-gate `/api/metrics`                      |

## Customising

- Pack catalogue: `src/lib/server/tokens/packs.ts`
- Model whitelist / deny list: `src/lib/server/openrouter/registry.ts`
- Cost-per-token rate: `USD_PER_TOKEN` in `src/lib/server/openrouter/pricing.ts`
- Daily allowance: `DAILY_ALLOWANCE_TOKENS`
- Branding: `src/routes/+layout.svelte`, `static/`, `PUBLIC_APP_NAME`

## Development

```bash
npm install
cp .env.example .env          # set DATABASE_URL to a local Postgres
npm run db:migrate
npm run db:seed
npm run dev
```

Other useful commands:

```bash
npm run check                 # svelte-check + tsc
npm run lint                  # prettier + eslint
npm run test:unit             # vitest
npm run test:e2e              # playwright
npm run db:studio             # drizzle-kit studio
npm run stripe:sync           # push PACKS into Stripe + write back stripe_price_id
```

## Architecture

- `src/routes/` — pages and JSON/SSE endpoints (`+page.svelte`, `+server.ts`).
- `src/lib/server/db/` — Drizzle schema, migrations live in `drizzle/`.
- `src/lib/server/openrouter/` — model registry, pricing, generation client.
- `src/lib/server/storage/` — pluggable object store (R2 binding or S3 HTTP via
  `aws4fetch`).
- `src/lib/server/tokens/` — pack catalogue, daily-allowance grant, balance
  arithmetic.
- `src/lib/server/stripe/` — checkout, webhook handlers, price-sync.
- `src/lib/server/ratelimit/` — token-bucket, KV-backed in production,
  in-memory in dev.
- `src/lib/server/abuse/` + `src/lib/server/moderation/` — prompt moderation
  and cancel paths.
- `src/lib/server/log/` — structured logger, request-id middleware, Sentry
  envelope, Prom metrics.
- `svelte.config.js` swaps between `adapter-cloudflare` (default) and
  `adapter-node` when `BUILD_TARGET=node` is set.

The generation pipeline streams progress over SSE from
`/api/generations/[id]/events`; the worker writes blobs to R2 and rows to
Postgres as each image lands.

## Self-hosting checklist

- [ ] `BETTER_AUTH_SECRET` set (32+ chars)
- [ ] SMTP or Resend configured (`EMAIL_FROM`, `RESEND_API_KEY` or `SMTP_URL`)
- [ ] R2/S3 bucket created and CORS allows your `ORIGIN`
- [ ] Stripe products synced (`npm run stripe:sync`)
- [ ] Stripe webhook pointed at `/api/webhooks/stripe` with the matching
      `STRIPE_WEBHOOK_SECRET`
- [ ] AdSense client ID + slot IDs filled in (optional)
- [ ] `curl -fsS $ORIGIN/api/healthz` returns `{ "ok": true }`

## License

[AGPL-3.0](LICENSE). If you run a modified Prism as a network service you must
make your modified source available to your users.
