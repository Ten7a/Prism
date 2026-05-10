# 10 — Consent & legal (GDPR)

## Goal

Make Prism GDPR-compliant: a granular cookie banner, persisted consent records, versioned Privacy Policy + Terms of Service, an account-level privacy panel, and a working DSAR (data subject access request) export + delete flow.

## Touches

- `src/lib/components/CookieBanner.svelte` — the banner (necessary always on, analytics + ads togglable).
- `src/lib/stores/consent.ts` — already drafted in step 09; finalised here.
- `src/lib/server/consent/store.ts` — read/write `consentRecord` rows.
- `src/routes/api/consent/+server.ts` — `POST` upsert; `GET` returns current state.
- `src/lib/legal/privacy.md` + `terms.md` + `versions.ts` — versioned markdown content.
- `src/routes/legal/privacy/+page.svelte`, `legal/terms/+page.svelte` — render markdown.
- `src/routes/account/privacy/+page.svelte` + `+page.server.ts` — adjust consent post-signup, view records, request export, delete account.
- `src/routes/api/account/export/+server.ts` — `GET` returns user's data as a single JSON download.

## Reuses

- `consentRecord` table from step 01.
- `account/delete` action from step 02.
- `marked` (or `markdown-it`) for legal markdown → HTML.

## Banner UX

- Pinned bottom-right, glass-style (uses `@utility glass` from step 00).
- Two CTAs: **Accept all** and **Customize**. Customize expands inline with three toggles (Necessary [disabled, on], Analytics, Ads) + **Save preferences**.
- Closing the banner without choosing → necessary-only.
- Cookie: `prism.consent` = JSON `{ v: '<policyVersion>', necessary, analytics, ads, ts }`, max-age 13 months. Re-shows when version bumps.

## Privacy policy outline

(Draft for `privacy.md`; the LLM that executes the plan should expand it; user reviews before going live.)

```
# Privacy Policy
Effective: <YYYY-MM-DD>  ·  Version: 1.0

Prism ("we", "us") provides AI image generation. This document describes what
data we collect, why, where it is stored, and your rights under the EU GDPR
and UK GDPR.

## 1 Data we collect
- Account: email, hashed password (or OAuth subject id), display name (optional)
- Generation: prompts you submit, models selected, generated image bytes,
  reference images you upload, timestamps
- Billing: Stripe customer id, transaction ids — *we never see your card data*
- Operational: IP address (only for rate limiting; not retained after 30 days),
  user-agent (only on auth events), request id

## 2 Why we collect it (legal bases)
| Purpose                   | Legal basis (GDPR Art. 6)            |
| Provide the service        | Contract — Art. 6(1)(b)             |
| Bill you for tokens        | Contract — Art. 6(1)(b)             |
| Prevent abuse              | Legitimate interest — Art. 6(1)(f)   |
| Show ads (optional)        | Consent — Art. 6(1)(a)               |
| Analytics (optional)       | Consent — Art. 6(1)(a)               |
| Send transactional email   | Contract — Art. 6(1)(b)              |

## 3 Sub-processors
| Vendor           | Purpose                | Country |
| OpenRouter       | AI model routing        | US      |
| Cloudflare R2    | Image storage           | EU/US   |
| Stripe           | Payments                | US/IE   |
| Resend           | Transactional email      | US      |
| <DB host>        | Database                | <…>     |

## 4 Retention
Account data: until you delete your account. Generated images: until you delete them.
Logs: 30 days. Backups: 14 days.

## 5 Your rights
Access, rectification, erasure, portability, restriction, objection, withdraw consent.
Exercise via /account/privacy or by emailing privacy@prism.<host>.

## 6 Transfers
EU→US transfers rely on Standard Contractual Clauses with each sub-processor.

## 7 Contact / DPO
[Contact info — fill in before going live]

## 8 Changes
We notify you of material changes by email and on the site.
```

ToS gets a parallel structure (acceptable use, IP ownership of generations, indemnity, governing law).

## Steps

1. Build `CookieBanner.svelte` and mount it from `+layout.svelte` (z-index above scanlines).
2. `POST /api/consent` validates payload, upserts a `consent_record` row keyed by `userId` (or `anon_id` cookie if signed out), returns 204.
3. Banner saves to cookie _and_ fires the API call when authenticated.
4. `versions.ts` exports `POLICY_VERSION = '1.0'` — banner re-prompts when this changes.
5. Render legal pages from markdown via a server load + `marked`. Add a "What changed in this version?" diff link at the top.
6. `/account/privacy` shows: current consent state (toggleable), full consent history, **Export my data** button → triggers `/api/account/export` (returns JSON `{ user, ledger, jobs, images: [{id, key, …}], consents }`), **Delete my account** button → reuses the action from step 02.
7. Footer link in `+layout.svelte` → `/legal/privacy` and `/legal/terms`.

## Tests

`src/lib/server/consent/store.spec.ts`:

```ts
test('GET /api/consent returns server-side state for signed-in user', async () => {
	const u = await seedUser();
	await upsertConsent({ userId: u.id, version: '1.0', analytics: true, ads: false });
	const res = await get('/api/consent', { user: u });
	expect(await res.json()).toMatchObject({ analytics: true, ads: false });
});

test('upsert keyed by anon cookie for unauthenticated visitors', async () => {
	await upsertConsent({ anonId: 'anon_abc', version: '1.0', analytics: false, ads: false });
	// re-visit and update
	await upsertConsent({ anonId: 'anon_abc', version: '1.0', analytics: true, ads: true });
	const rows = await listConsents({ anonId: 'anon_abc' });
	expect(rows).toHaveLength(2); // history preserved
});
```

`e2e/banner.test.ts`:

```ts
test('banner appears for new visitor and disappears after Accept all', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText(/we use cookies/i)).toBeVisible();
	await page.getByRole('button', { name: /accept all/i }).click();
	await expect(page.getByText(/we use cookies/i)).not.toBeVisible();
	await page.reload();
	await expect(page.getByText(/we use cookies/i)).not.toBeVisible();
});

test('Customize → Save necessary-only does not load ads/analytics', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: /customize/i }).click();
	await page.getByRole('button', { name: /save preferences/i }).click();
	await expect(page.locator('script[src*="pagead2"]')).toHaveCount(0);
});

test('export endpoint returns user payload', async ({ page, request }) => {
	await loginAs(page, 'e2e@prism.test');
	const res = await request.get('/api/account/export');
	expect(res.status()).toBe(200);
	const body = await res.json();
	expect(body).toHaveProperty('user.email', 'e2e@prism.test');
	expect(body).toHaveProperty('ledger');
	expect(body).toHaveProperty('jobs');
});
```

Edge case: bumping `POLICY_VERSION` from `1.0` → `1.1` should re-trigger the banner for users who only consented to `1.0`. Test: set cookie to `{v: '1.0', …}`, set runtime version to `1.1`, reload → banner visible.

## Verify

```bash
npm run check
npm run test:unit -- --run src/lib/server/consent
npm run test:e2e -- e2e/banner.test.ts
npm run dev   # walk through banner, /legal/*, /account/privacy → export
```

Acceptance: banner appears once, three-state consent persists in DB + cookie, legal pages render the correct version, the export endpoint returns a complete JSON dump, deleting the account wipes the user from every Prism table.
