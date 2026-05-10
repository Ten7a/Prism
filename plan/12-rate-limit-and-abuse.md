# 12 — Rate limiting & abuse

## Goal

Stop runaway costs and abuse: per-IP and per-user rate limits, a moderation pre-check on prompts, and a cancellation path for in-flight jobs.

## Touches

- `src/lib/server/ratelimit/index.ts` — driver-agnostic limiter (token bucket).
- `src/lib/server/ratelimit/kv.ts` — Cloudflare KV implementation (atomic via `expirationTtl` + `metadata`).
- `src/lib/server/ratelimit/memory.ts` — in-process fallback for Node/dev/tests.
- `src/lib/server/moderation/check.ts` — calls OpenRouter's moderation model (e.g. `omni-moderation-latest` if available, else a Llama Guard variant).
- `src/lib/server/abuse/blocklist.ts` — simple substring + regex blocklist seeded with policy keywords.
- `src/hooks.server.ts` — apply IP limit to `/api/*`.
- `src/routes/api/generations/+server.ts` — apply user limit + moderation before insert (extends step 05).
- `src/routes/api/generations/[id]/cancel/+server.ts` — `POST` cancels a queued/running job.
- `.env.example` — `RATE_LIMIT_ANON=60/m`, `RATE_LIMIT_USER=200/h`, `MODERATION_MODEL=…`.

## Reuses

- OpenRouter client from step 03.
- `failJob` helper from step 01 for cancellations (refunds the estimate).
- Cloudflare KV binding name `RATE_LIMIT` declared in `wrangler.toml`.

## Limits (initial)

| Scope              | Limit            | Notes                                          |
| ------------------ | ---------------- | ---------------------------------------------- |
| Anon `/api/*`      | 60 req / minute  | by `cf-connecting-ip`                          |
| User `/api/*`      | 600 req / hour   | by `userId`                                    |
| `/api/generations` | 30 / hour / user | hard limit independent of token balance        |
| `/api/uploads`     | 30 / hour / user | already mentioned in step 04 — formalised here |

## Token-bucket sketch

```ts
export interface Limiter {
	hit(
		key: string,
		opts: { capacity: number; refillPerSec: number }
	): Promise<{ allowed: boolean; retryAfterSec?: number }>;
}
```

KV impl stores `{ tokens, lastMs }` JSON; atomic enough at this scale because we accept a small race window (caps are coarse).

## Steps

1. Implement `memory.ts` first (pure JS, no infra). Use it for unit tests.
2. Implement `kv.ts` for Workers using `RATE_LIMIT.get` + `RATE_LIMIT.put({ expirationTtl })`.
3. Wire `hooks.server.ts`: for `/api/*` routes, derive key from `userId ?? ip`, apply limit, return `429` with `Retry-After` header on deny.
4. `moderation/check.ts`:
   - Calls OpenRouter `POST /moderations` (or fallback chat-completions with a system prompt) and parses the `flagged` boolean + categories.
   - Cached result by SHA-256 of the prompt for 1h to avoid repeated charges on retries.
5. In `/api/generations` POST: run blocklist (instant) → moderation (async) → if either rejects, return `422 { code: 'prompt_blocked', categories }` and don't debit anything.
6. `/api/generations/[id]/cancel`:
   - Auth + ownership.
   - If `status='queued'` or `status='running'`, mark `cancelled`, refund estimate, notify `job:{id}` channel with `cancelled` event so SSE clients can close.
   - If already terminal, return `409`.
7. The dispatcher loop (step 05) checks job status before each batch shard and aborts if `cancelled`.

## Tests

`src/lib/server/ratelimit/memory.spec.ts`:

```ts
test('token bucket allows up to capacity', async () => {
	const l = createMemoryLimiter();
	for (let i = 0; i < 5; i++) {
		expect((await l.hit('k', { capacity: 5, refillPerSec: 0 })).allowed).toBe(true);
	}
	expect((await l.hit('k', { capacity: 5, refillPerSec: 0 })).allowed).toBe(false);
});

test('refills over time', async () => {
	const l = createMemoryLimiter();
	for (let i = 0; i < 5; i++) await l.hit('k', { capacity: 5, refillPerSec: 5 });
	vi.advanceTimersByTime(1000);
	expect((await l.hit('k', { capacity: 5, refillPerSec: 5 })).allowed).toBe(true);
});

test('429 includes Retry-After', async () => {
	// … hooks.server integration test
});
```

`src/lib/server/moderation/check.spec.ts` (msw):

```ts
test('caches by prompt hash', async () => {
	await checkPrompt('cat');
	await checkPrompt('cat');
	expect(msw.calls('/moderations')).toBe(1);
});

test('returns flagged=true for synthetic violation', async () => {
	msw.use(
		http.post('*/moderations', () => HttpResponse.json({ flagged: true, categories: ['violence'] }))
	);
	expect((await checkPrompt('xx')).flagged).toBe(true);
});
```

`e2e/abuse.test.ts`:

```ts
test('flooding /api/generations triggers 429', async ({ request }) => {
	await loginAs(request, 'e2e@prism.test');
	let rejected = 0;
	await Promise.all(
		[...Array(50)].map(async () => {
			const r = await request.post('/api/generations', { data: validPayload });
			if (r.status() === 429) rejected++;
		})
	);
	expect(rejected).toBeGreaterThan(0);
});

test('blocked prompt is rejected without debit', async ({ request }) => {
	const before = await getBalanceFor('e2e@prism.test');
	const r = await request.post('/api/generations', {
		data: { ...validPayload, prompt: BLOCKED_TEST_FIXTURE }
	});
	expect(r.status()).toBe(422);
	expect(await getBalanceFor('e2e@prism.test')).toBe(before);
});

test('cancel running job refunds tokens', async ({ request }) => {
	// … create job that takes time, cancel mid-flight, check refund
});
```

Edge case: blocklist matches inside a longer benign prompt (e.g. a substring) — write a test that the matcher uses word boundaries / token boundaries, not naive `String.includes`.

## Verify

```bash
npm run check
npm run test:unit -- --run src/lib/server/ratelimit src/lib/server/moderation
npm run test:e2e -- e2e/abuse.test.ts
```

Acceptance: hammering `/api/generations` past the configured cap returns 429 with a sane `Retry-After`; flagged prompts are rejected before any cost is incurred; cancelling a running job refunds tokens and closes the SSE stream.
