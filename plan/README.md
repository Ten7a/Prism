# Prism — Build Plan

This directory contains the implementation plan for **Prism**, a token-based image generator described in [`../IDEA.md`](../IDEA.md).

The work is sliced into numbered, independently shippable steps. Each step file follows the same template:

- **Goal** — one sentence.
- **Touches** — files created/edited.
- **Reuses** — existing utilities/patterns we should not re-invent.
- **Steps** — ordered checklist.
- **Tests** — concrete unit + e2e tests covering happy path, failure path, edge case.
- **Verify** — commands to run and acceptance criteria.

## Confirmed stack

| Concern          | Choice                                                          |
| ---------------- | --------------------------------------------------------------- |
| Framework        | SvelteKit 2 + Svelte 5 (already scaffolded)                     |
| Styling          | Tailwind v4 + monospace black/white, ported from portfolio      |
| Auth             | Better Auth (email/password + GitHub) — already wired           |
| DB               | Postgres (self-hosted via Docker) + Drizzle ORM                 |
| Image storage    | Cloudflare R2 (S3-compatible)                                   |
| Image gen        | OpenRouter — full image-output catalog via dynamic registry     |
| Pipeline         | Async — job rows + SSE progress channel                         |
| Web payments     | Stripe Checkout + webhook → token ledger credit                 |
| Ads (web)        | Google AdSense, consent-gated                                   |
| Email            | Resend (with SMTP fallback for self-hosters)                    |
| Deploy           | Cloudflare Workers (`adapter-cloudflare`); Node Docker fallback |
| Tests            | Vitest (unit), Playwright (e2e), MSW for HTTP mocks             |
| Mobile (Phase 7) | Capacitor + RevenueCat + AdMob                                  |

## Step order

| #   | File                                                 | Phase |
| --- | ---------------------------------------------------- | ----- |
| 00  | [foundations](./00-foundations.md)                   | v1    |
| 01  | [database-schema](./01-database-schema.md)           | v1    |
| 02  | [auth-and-account](./02-auth-and-account.md)         | v1    |
| 03  | [model-registry](./03-model-registry.md)             | v1    |
| 04  | [storage-r2](./04-storage-r2.md)                     | v1    |
| 05  | [generation-pipeline](./05-generation-pipeline.md)   | v1    |
| 06  | [library](./06-library.md)                           | v1    |
| 07  | [tokens-and-packs](./07-tokens-and-packs.md)         | v1    |
| 08  | [stripe-checkout](./08-stripe-checkout.md)           | v1    |
| 09  | [ads-adsense](./09-ads-adsense.md)                   | v1    |
| 10  | [consent-and-legal](./10-consent-and-legal.md)       | v1    |
| 11  | [design-system](./11-design-system.md)               | v1    |
| 12  | [rate-limit-and-abuse](./12-rate-limit-and-abuse.md) | v1    |
| 13  | [observability](./13-observability.md)               | v1    |
| 14  | [self-host-readme](./14-self-host-readme.md)         | v1    |
| 20  | [mobile-capacitor](./20-mobile-capacitor.md)         | v2    |

## How to follow the plan

1. Pick the lowest-numbered unfinished step.
2. Read its **Goal** and **Reuses** sections first — don't reinvent existing helpers.
3. Make the changes in **Touches** in the order given by **Steps**.
4. Add the tests in **Tests** alongside (or before) the code — TDD where practical.
5. Run **Verify** locally; if green, ship; if red, fix before moving on.

## Global verification

Every step must end with a green run of:

```bash
npm run check
npm run test:unit -- --run
npm run test:e2e
```

The final v1 acceptance flow is documented in [14-self-host-readme.md](./14-self-host-readme.md).
