# 03 — OpenRouter model registry

## Goal

Build a registry that enumerates every OpenRouter model with image output, normalises wildly different pricing schemes into a single "internal token" cost, and exposes a typed `estimateCost(modelId, quality, ratio, batch)` helper. The registry also feeds the model picker UI.

## Touches

- `src/lib/server/openrouter/registry.ts` — fetcher, cache, types.
- `src/lib/server/openrouter/pricing.ts` — pricing-shape normalisation.
- `src/lib/server/openrouter/static-fallback.ts` — committed snapshot used offline + in tests.
- `src/lib/server/openrouter/client.ts` — base `fetch` wrapper that signs requests with `OPENROUTER_API_KEY`.
- `src/routes/api/models/+server.ts` — `GET` returns the cached catalogue for the picker.
- `.env.example` — `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`).

## Reuses

- Cloudflare KV binding (`platform.env.MODEL_CACHE`) on Workers; in-memory `Map` fallback for Node/dev.
- `fetch` (no SDK needed — OpenRouter is REST-only).

## Pricing shapes (from research)

| Shape          | Models                                          | Calc                                                              |
| -------------- | ----------------------------------------------- | ----------------------------------------------------------------- |
| per-image flat | `bytedance-seed/seedream-4.5`                   | `imagePrice * batch`                                              |
| per-image tier | `sourceful/riverflow-v2-{fast,pro}`             | `tierPrice(quality) * batch`                                      |
| per-MP         | `black-forest-labs/flux.2-{pro,max,klein-4b}`   | `(firstMP + (mp-1)*subsequentMP) * batch`                         |
| per-token      | `google/gemini-*-image*`, `openai/gpt-*-image*` | `inToks*inPrice + outToks*outPrice` (estimate from quality+batch) |

Internal-token conversion: `tokens = ceil(usdCost / USD_PER_TOKEN)` where `USD_PER_TOKEN = 0.01` (1 internal token ≈ $0.01). All published cost tables use this constant; changing it is a versioned migration.

## Types

```ts
export type Quality = '1k' | '2k' | '4k';
export type Ratio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';

export interface ModelEntry {
	id: string; // 'google/gemini-2.5-flash-image'
	displayName: string;
	capabilities: { textToImage: boolean; imageToImage: boolean; edit: boolean };
	supportedQualities: Quality[];
	supportedRatios: Ratio[];
	pricing: PricingShape; // tagged union
	fetchedAt: number; // ms
}
```

## Steps

1. `client.ts` — `orFetch(path, init)` adds `Authorization: Bearer ${OPENROUTER_API_KEY}` and the recommended `HTTP-Referer` + `X-Title` headers.
2. `registry.ts`:
   - `loadModels()` — checks cache, otherwise calls `GET /models?output_modalities=image`, parses, runs each entry through `pricing.ts:normalise()`, stores 24h.
   - On Workers: `caches.default.put` keyed by URL + ETag, plus a KV mirror so multiple isolates share.
   - On failure: returns `static-fallback.ts` (snapshot the response now and check it in).
3. `pricing.ts:estimateCost(model, { quality, ratio, batch })`:
   - Switches on `model.pricing.shape`.
   - Quality → MP (`1k≈1MP`, `2k≈4MP`, `4k≈8MP`) for per-MP shapes.
   - Quality → output-token estimate (constants per family) for per-token shapes.
   - Returns `{ internalTokens, usdEstimate }`.
4. `+server.ts` GET — returns `{ models: ModelEntry[] }`. Public, cacheable for 5 min.

## Tests

`src/lib/server/openrouter/pricing.spec.ts`:

```ts
test('per-image flat: seedream batch=4 = 4 * tokens(0.04 USD)', () => {
	const m = mock({ shape: 'per-image-flat', usd: 0.04 });
	expect(estimateCost(m, { quality: '1k', ratio: '1:1', batch: 4 }).internalTokens).toBe(
		Math.ceil((0.04 * 4) / 0.01)
	);
});

test('per-MP: flux.2-pro at 2k (≈4MP) batch=1 = first 0.03 + 3*0.015', () => {
	const m = mock({ shape: 'per-mp', firstUsd: 0.03, subsequentUsd: 0.015 });
	const out = estimateCost(m, { quality: '2k', ratio: '1:1', batch: 1 });
	expect(out.usdEstimate).toBeCloseTo(0.03 + 3 * 0.015, 5);
});

test('per-token: gemini flash uses output-token estimate that scales with quality', () => {
	const m = mock({ shape: 'per-token', inUsd: 0.0000003, outUsd: 0.0000025 });
	const c1 = estimateCost(m, { quality: '1k', ratio: '1:1', batch: 1 });
	const c4 = estimateCost(m, { quality: '4k', ratio: '1:1', batch: 1 });
	expect(c4.usdEstimate).toBeGreaterThan(c1.usdEstimate);
});
```

`src/lib/server/openrouter/registry.spec.ts` (msw):

```ts
test('caches catalogue 24h', async () => {
	const a = await loadModels();
	const b = await loadModels();
	expect(msw.calls('/models')).toBe(1);
	expect(a).toEqual(b);
});

test('falls back to snapshot when API errors', async () => {
	msw.use(http.get('*/models', () => HttpResponse.error()));
	const m = await loadModels();
	expect(m.find((x) => x.id === 'google/gemini-2.5-flash-image')).toBeTruthy();
});
```

`e2e/api-models.test.ts`: `GET /api/models` returns ≥ 5 entries, each has a non-zero `pricing` field.

## Verify

```bash
npm run check
npm run test:unit -- --run src/lib/server/openrouter
curl -s http://localhost:5173/api/models | jq '.models | length'
```

Acceptance: catalogue is fetched live in dev, cached 24h, snapshot fallback works offline, and cost estimation matches hand-computed values for at least one model in each pricing shape.
