# 08 — Stripe checkout

## Goal

Take real money: a Stripe Checkout flow for token packs, an idempotent webhook that credits the ledger, transactional receipts via Resend, and a customer-portal link for invoices/refunds.

## Touches

- `src/lib/server/stripe/client.ts` — `Stripe` SDK init.
- `src/lib/server/stripe/sync-prices.ts` — sync `PACKS` → Stripe products+prices on dev boot (`stripe.products.upsert`-ish via list + create).
- `src/routes/api/billing/checkout/+server.ts` — `POST` create Checkout Session.
- `src/routes/api/billing/portal/+server.ts` — `POST` create Customer Portal session.
- `src/routes/api/webhooks/stripe/+server.ts` — `POST` handle `checkout.session.completed`, `charge.refunded`.
- `src/routes/billing/success/+page.svelte` — confirmation; balance refreshed.
- `src/routes/billing/cancel/+page.svelte` — soft "no charge" message.
- `src/lib/server/email/templates/receipt.ts` — receipt email.
- `.env.example` — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLIC_KEY` (frontend, optional for hosted Checkout).
- `src/hooks.server.ts` — `csrf` exempt for `/api/webhooks/stripe`.

## Reuses

- `tokenLedger` `uniq_stripe_event` index from step 01 (idempotency).
- `getEffectiveBalance` from step 07 for the success page redirect.
- Resend transport from step 02.
- `PACKS` catalogue from step 07.

## Steps

1. Add `stripe` to dependencies.
2. `client.ts`: `new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '<pinned>', httpClient: Stripe.createFetchHttpClient() })` — fetch-based client works on Workers.
3. `sync-prices.ts`: idempotent — for each pack, find product by `metadata.slug=pack.slug` or create; same for price (compare `unit_amount`+`currency`); store the resolved `stripe_price_id` back into the `token_pack` row.
4. `checkout/+server.ts`:
   - Auth required.
   - Body `{ pack: slug }`.
   - Look up `token_pack` by slug; refuse if `!active`.
   - `stripe.checkout.sessions.create({ mode: 'payment', customer_email: user.email, line_items: [{ price: pack.stripePriceId, quantity: 1 }], metadata: { userId, packSlug }, success_url: '/billing/success?session_id={CHECKOUT_SESSION_ID}', cancel_url: '/billing/cancel', payment_intent_data: { metadata: { userId, packSlug } } })`
   - Return `{ url: session.url }`. Client navigates.
5. `portal/+server.ts`: needs a stripe customer id — store one on first checkout into a new `user.stripeCustomerId` column (extend Better Auth's user table via Drizzle migration). Returns the portal URL.
6. `webhooks/stripe/+server.ts`:
   - Read raw body (`request.text()`), call `stripe.webhooks.constructEventAsync(body, sig, secret)`.
   - Switch on `event.type`:
     - `checkout.session.completed` (or `payment_intent.succeeded` — pick one and stick with it): pull `userId`, `packSlug` from metadata, look up `token_pack`, insert `tokenLedger { userId, delta: pack.tokens, reason: 'pack_purchase', stripeEventId: event.id }`. Catch unique violation = already processed = 200 OK.
     - `charge.refunded`: insert reversing ledger row keyed by `event.id`.
   - Send Resend receipt after credit on `checkout.session.completed`.
   - Always return 200 quickly; `waitUntil` for the side effects on Workers.
7. `/billing/success`:
   - Server load: refresh balance, compute `delta = newBalance - localStorage.previousBalance`.
   - Render: "✓ Purchased N tokens. Balance: M." with link to `/generate`.

## Tests

`src/routes/api/webhooks/stripe/server.spec.ts`:

```ts
test('valid signed event credits exactly once', async () => {
	const u = await seedUser();
	await seedPacks();
	const event = signedEvent('checkout.session.completed', {
		id: 'evt_test_1',
		metadata: { userId: u.id, packSlug: 'starter' }
	});
	await POST({ request: event.req });
	expect(await getBalance(u.id)).toBe(100);
	// replay the same event:
	await POST({ request: event.req });
	expect(await getBalance(u.id)).toBe(100); // unchanged
});

test('invalid signature returns 400', async () => {
	const tampered = await tamperSignature(validEvent());
	const res = await POST({ request: tampered });
	expect(res.status).toBe(400);
});

test('charge.refunded reverses the credit', async () => {
	// … credit 100 via evt_a, then refund via evt_b → balance drops by 100
});
```

`src/lib/server/stripe/sync-prices.spec.ts`:

```ts
test('idempotent: running twice does not create duplicate prices', async () => {
	await syncPrices();
	await syncPrices();
	expect(stripeMock.calls('POST', '/v1/products')).toHaveLength(4); // PACKS.length
	expect(stripeMock.calls('POST', '/v1/prices')).toHaveLength(4);
});
```

`e2e/billing.test.ts`:

```ts
test('starter pack purchase flow with Stripe test mode', async ({ page }) => {
	await loginAs(page, 'e2e@prism.test');
	await page.goto('/pricing');
	await page.getByRole('link', { name: /buy 100/i }).click();
	await page.waitForURL(/checkout\.stripe\.com/);
	await fillStripeTestCard(page); // helper
	await page.waitForURL(/billing\/success/);
	await page.goto('/account');
	await expect(page.getByTestId('balance')).toContainText('100');
});
```

Edge case: webhook arrives before the user finishes the redirect (it does, often). Test that `/billing/success` still shows credited balance because the webhook has already run server-side (poll `/api/balance` from the success page if needed).

## Verify

```bash
npm run check
npm run test:unit -- --run
# Local webhook dev:
stripe listen --forward-to localhost:5173/api/webhooks/stripe
npm run dev
# in another terminal: trigger a real test-mode purchase end-to-end
```

Acceptance: a $5 starter pack purchase in Stripe test mode credits exactly 100 tokens, a Resend receipt is sent, replaying the webhook does **not** double-credit, signature verification rejects forged payloads.
