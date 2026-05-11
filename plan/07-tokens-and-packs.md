# 07 — Tokens & packs

## Goal

Make the token economy real: a free daily allowance granted lazily, the canonical `getBalance` helper, the published packs catalogue, and pre-flight balance checks for the generation pipeline.

## Touches

- `src/lib/server/tokens/grant.ts` — `grantDailyAllowanceIfDue(userId)`.
- `src/lib/server/tokens/balance.ts` — wraps `getBalance` from step 01 with daily-grant trigger.
- `src/lib/server/tokens/packs.ts` — exported `PACKS` array (single source of truth).
- `src/lib/server/db/seed-packs.ts` — seeds the `token_pack` rows on first run.
- `src/routes/api/balance/+server.ts` — `GET` returns `{ balance, dailyAllowance, nextReset }`.
- `src/routes/pricing/+page.svelte` — public-facing packs page.
- `src/hooks.server.ts` — call `grantDailyAllowanceIfDue` on every authenticated request (idempotent).
- `.env.example` — `DAILY_ALLOWANCE_TOKENS` (default 10).

## Reuses

- `tokenLedger` partial unique index `uniq_daily_grant` from step 01 (does the heavy lifting).
- `auth.locals.user` from step 02.

## Pack catalogue (initial)

| Slug      | Tokens | Price  | Notes                |
| --------- | ------ | ------ | -------------------- |
| `starter` | 100    | $5.00  | ≈ 25 standard images |
| `pro`     | 250    | $10.00 | best $/token         |
| `studio`  | 600    | $20.00 |                      |
| `bulk`    | 2000   | $50.00 | best for power users |

Tokens are dimensioned at $0.01 ≈ 1 token (matching `USD_PER_TOKEN` from step 03).

## Steps

1. `grant.ts`:

   ```ts
   export async function grantDailyAllowanceIfDue(userId: string) {
   	const day = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
   	const tokens = Number(env.DAILY_ALLOWANCE_TOKENS ?? 10);
   	try {
   		await db.insert(tokenLedger).values({
   			userId,
   			delta: tokens,
   			reason: 'daily_grant',
   			dailyGrantDay: day
   		});
   	} catch (e) {
   		if (!isUniqueViolation(e)) throw e;
   		// already granted today → no-op
   	}
   }
   ```

2. `balance.ts:getEffectiveBalance(userId)` — calls `grantDailyAllowanceIfDue` then `getBalance`. Cheap: the unique-violation no-op is a single round-trip.
3. `hooks.server.ts` — after auth resolution, if `locals.user` exists call `grantDailyAllowanceIfDue` (don't await it on Workers; use `waitUntil`).
4. `/api/balance` returns `{ balance, dailyAllowance: tokens, nextResetAt: <next 00:00 UTC> }`.
5. `/pricing` page — render `PACKS` as 4 monospace `<RuleRow>` cards. Each links to `/api/billing/checkout?pack={slug}` (built in step 08).
6. Seed: on app boot in dev / on `db:seed` script, insert `PACKS` into `token_pack` if absent (`onConflictDoNothing` by `slug`).

## Tests

`src/lib/server/tokens/grant.spec.ts`:

```ts
test('grants 10 tokens on first call of the day', async () => {
	const u = await seedUser();
	await grantDailyAllowanceIfDue(u.id);
	expect(await getBalance(u.id)).toBe(10);
});

test('second call same UTC day is a no-op', async () => {
	const u = await seedUser();
	await grantDailyAllowanceIfDue(u.id);
	await grantDailyAllowanceIfDue(u.id);
	expect(await getBalance(u.id)).toBe(10);
	expect(await ledgerCount(u.id)).toBe(1);
});

test('next UTC day grants again', async () => {
	vi.setSystemTime(new Date('2026-05-09T23:59:00Z'));
	await grantDailyAllowanceIfDue(u.id);
	vi.setSystemTime(new Date('2026-05-10T00:00:01Z'));
	await grantDailyAllowanceIfDue(u.id);
	expect(await getBalance(u.id)).toBe(20);
});

test('balance never goes negative — generation refuses when balance < estimate', async () => {
	// covered by step 05 test, referenced here
});
```

`e2e/tokens.test.ts`:

```ts
test('new user lands on /generate with daily allowance already granted', async ({ page }) => {
	await signupAndVerify(page, 'fresh@prism.test');
	await page.goto('/generate');
	await expect(page.getByTestId('balance')).toHaveText(/10/);
});

test('/pricing renders 4 packs with stripe-shaped CTAs', async ({ page }) => {
	await page.goto('/pricing');
	await expect(page.getByRole('link', { name: /buy 100/i })).toHaveAttribute(
		'href',
		/checkout\?pack=starter/
	);
});
```

Edge case: race condition — two parallel requests on a fresh user shouldn't double-grant. The unique index guarantees this; add a vitest case that fires `Promise.all` of 5 grants and asserts balance is exactly 10.

## Verify

```bash
npm run check
npm run test:unit -- --run src/lib/server/tokens
npm run test:e2e -- e2e/tokens.test.ts
npm run dev   # /pricing renders, /api/balance returns expected JSON
```

Acceptance: every authenticated user has at least 10 tokens at the start of any UTC day, the daily-grant ledger row is unique per `(user, day)`, `/api/balance` is the single source of truth, and `/pricing` lists the four packs ready for Stripe checkout in step 08.
