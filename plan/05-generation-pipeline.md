# 05 — Generation pipeline

## Goal

End-to-end image generation: a `/generate` page that submits a prompt, an async job runner that calls OpenRouter, an SSE stream that pushes progress to the browser, and a refund-on-failure ledger flow.

## Touches

- `src/routes/generate/+page.svelte` — prompt box, model picker (from `/api/models`), ratio/quality/batch controls, reference-image dropzone, submit button.
- `src/routes/generate/+page.server.ts` — initial load: balance + cached model list.
- `src/routes/api/generations/+server.ts` — `POST` create job; `GET` list user's recent jobs.
- `src/routes/api/generations/[id]/+server.ts` — `GET` job detail.
- `src/routes/api/generations/[id]/events/+server.ts` — SSE stream.
- `src/lib/server/generations/dispatch.ts` — runs the OpenRouter call and writes results.
- `src/lib/server/generations/notify.ts` — Postgres `NOTIFY job:{id}` helper, plus an in-memory pub/sub fallback for tests/Workers.
- `src/lib/components/GenerationCard.svelte` — subscribes to SSE, renders progress + final images.
- `src/lib/server/openrouter/generate.ts` — model-call adapter (handles per-provider request/response shapes).

## Reuses

- `createJob` / `failJob` / `finishJob` from step 01.
- `estimateCost` from step 03.
- `storage().put` and key builders from step 04.
- Auth `locals.user` from step 02.

## Sequencing

```
Client                 SvelteKit                   Postgres                 OpenRouter            R2
  |                       |                            |                         |                  |
  |--POST /api/generations|                            |                         |                  |
  |                       |--BEGIN tx-----------------> insert ledger debit       |                  |
  |                       |                            |  insert generation_job  |                  |
  |                       |<--COMMIT-------------------|                         |                  |
  |<-- {id} 201           |                            |                         |                  |
  |--GET /…/events (SSE)->|                            |                         |                  |
  |                       |--LISTEN job:{id}---------->|                         |                  |
  |                       | (waitUntil) dispatch(id)                             |                  |
  |                       |               |--POST /chat/completions or /images-->|                  |
  |                       |               |<------ stream / images --------------|                  |
  |                       |               |--PUT image bytes -------------------------------------->|
  |                       |               |--update job + insert image rows ----->                  |
  |                       |               |--NOTIFY job:{id} progress / done ---->                  |
  |<-- SSE events --------|<--------------|                                      |                  |
```

## Steps

1. `dispatch.ts`:
   - Loads job + model entry.
   - Builds OpenRouter request via `openrouter/generate.ts` (per-shape: chat-completions for Gemini/GPT image models, `/images` endpoint for FLUX/Seedream/Riverflow — adapter pattern).
   - For `batch > 1`, fan out N concurrent requests with `Promise.allSettled`.
   - On each result: upload bytes to R2, insert `image` row, `notify({ type: 'image', i, key, dimensions })`.
   - On all-success: `finishJob(id, costActual)`. On any-failure: `failJob`, refund unused tokens, `notify({ type: 'error', code })`.
   - Wraps in try/catch — uncaught errors mark job failed and refund.
2. SSE endpoint: opens a `LISTEN job:{id}` on a dedicated postgres connection from a small pool, replays initial state from the row, then writes `data: {...}\n\n` lines on each notify. Closes on `done`/`error` or `AbortSignal`.
3. Workers note: `pg.LISTEN` doesn't work over Hyperdrive, so on Workers fall back to **short-poll inside the SSE handler** (`SELECT … WHERE id=$1` every 750ms) — code path branches on `platform`.
4. `POST /api/generations`:
   - Validate inputs with a zod schema (prompt 1–4000 chars, ratio/quality enum, batch 1–4).
   - Look up model via registry.
   - Compute estimate via `estimateCost`. Reject 402 if balance < estimate (after granting daily allowance — see step 07).
   - Insert ledger debit + job in a single tx.
   - Kick `dispatch(id)` via `event.platform.context.waitUntil(dispatch(id))` on Workers, or `void dispatch(id)` on Node.
   - Return `201 { id }`.
5. `GenerationCard.svelte`:
   - On mount, `new EventSource('/api/generations/{id}/events')`.
   - Render skeleton tiles (one per `batch`), fill them as `image` events arrive.
   - Show error state with retry CTA on `error` event.
6. `/generate` page composition: prompt textarea (mono, 1px rule), model `<select>` populated from `/api/models`, segmented controls for ratio + quality, number stepper for batch (1–4), reference-image dropzone (calls `/api/uploads`, stores returned keys), submit button shows estimated cost ("≈ 6 tokens") and disables when `balance < estimate`.

## Tests

`src/lib/server/generations/dispatch.spec.ts` (vitest, msw, real test DB):

```ts
test('happy path: 1k batch=1 debits → uploads → finishes', async () => {
  msw.use(http.post('https://openrouter.ai/api/v1/images', () => HttpResponse.json(fakeImageResp)));
  const u = await seedUser({ tokens: 100 });
  const job = await postGenerate(u, { model: 'bytedance-seed/seedream-4.5', quality: '1k', batch: 1, prompt: 'cat' });
  await waitForJob(job.id, 'succeeded');
  expect(await getBalance(u.id)).toBe(100 - 4); // seedream 0.04 USD ≈ 4 tokens
  expect(await listImages(job.id)).toHaveLength(1);
});

test('failure refunds the estimate', async () => {
  msw.use(http.post('https://openrouter.ai/api/v1/images', () => HttpResponse.error()));
  const u = await seedUser({ tokens: 100 });
  const before = await getBalance(u.id);
  const job = await postGenerate(u, { model: 'bytedance-seed/seedream-4.5', quality: '1k', batch: 2, prompt: 'cat' });
  await waitForJob(job.id, 'failed');
  expect(await getBalance(u.id)).toBe(before);
});

test('partial batch failure refunds only the failed shards', async () => {
  // 4-batch where 2 succeed, 2 fail → 2 images saved, 2 tokens refunded
});

test('insufficient balance returns 402 without inserting a job', async () => {
  const u = await seedUser({ tokens: 0 });
  const r = await postGenerate(u, { … });
  expect(r.status).toBe(402);
  expect(await listJobs(u.id)).toHaveLength(0);
});
```

`e2e/generate.test.ts`:

```ts
test('end-to-end with mocked OpenRouter', async ({ page }) => {
  await loginAs(page, 'e2e@prism.test');
  await page.goto('/generate');
  await page.getByPlaceholder('Describe an image').fill('a quiet city street at dawn');
  await page.getByRole('combobox', { name: 'Model' }).selectOption('google/gemini-2.5-flash-image');
  await page.getByRole('button', { name: /generate/i }).click();
  await expect(page.locator('[data-testid="job-progress"]')).toBeVisible();
  await expect(page.locator('img[data-testid="generated"]').first()).toBeVisible({ timeout: 10_000 });
});
```

## Verify

```bash
npm run check
npm run test:unit -- --run src/lib/server/generations
npm run test:e2e -- e2e/generate.test.ts
npm run dev   # generate a real image with a real OPENROUTER_API_KEY
```

Acceptance: a logged-in user with ≥4 tokens can submit a prompt, watch progress via SSE, and see the image rendered on the page within ~10s; balance debits correctly and refunds on simulated failure.
