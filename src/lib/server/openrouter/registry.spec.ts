import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

process.env.OPENROUTER_API_KEY = 'or_test_dummy';
process.env.OPENROUTER_BASE_URL = 'https://openrouter.test/api/v1';

vi.mock('$env/dynamic/private', () => ({ env: process.env }));

let modelsCalls = 0;

const sampleResponse = {
	data: [
		{
			id: 'google/gemini-2.5-flash-image',
			name: 'Gemini 2.5 Flash Image',
			input_modalities: ['text', 'image'],
			output_modalities: ['image'],
			pricing: { prompt: '0.0000003', completion: '0.0000025' }
		},
		{
			id: 'black-forest-labs/flux.2-pro',
			name: 'FLUX.2 Pro',
			input_modalities: ['text'],
			output_modalities: ['image'],
			pricing: { image: '0.03' }
		},
		{
			id: 'bytedance-seed/seedream-4.5',
			name: 'Seedream 4.5',
			input_modalities: ['text', 'image'],
			output_modalities: ['image'],
			pricing: { image: '0.04' }
		}
	]
};

const server = setupServer(
	http.get('https://openrouter.test/api/v1/models', () => {
		modelsCalls += 1;
		return HttpResponse.json(sampleResponse);
	})
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
	server.resetHandlers();
	modelsCalls = 0;
});
afterAll(() => server.close());

beforeEach(async () => {
	const { _resetCacheForTests } = await import('./registry');
	_resetCacheForTests();
});

describe('loadModels', () => {
	test('caches catalogue across calls (one network hit)', async () => {
		const { loadModels } = await import('./registry');
		const a = await loadModels();
		const b = await loadModels();
		expect(modelsCalls).toBe(1);
		expect(a).toBe(b);
		expect(a.length).toBe(3);
	});

	test('falls back to snapshot when API errors', async () => {
		server.use(http.get('https://openrouter.test/api/v1/models', () => HttpResponse.error()));
		const { loadModels } = await import('./registry');
		const m = await loadModels();
		expect(m.find((x) => x.id === 'google/gemini-2.5-flash-image')).toBeTruthy();
		expect(m.length).toBeGreaterThanOrEqual(5);
	});

	test('falls back when API returns non-200', async () => {
		server.use(
			http.get('https://openrouter.test/api/v1/models', () =>
				HttpResponse.json({ error: 'oops' }, { status: 500 })
			)
		);
		const { loadModels } = await import('./registry');
		const m = await loadModels();
		expect(m.length).toBeGreaterThanOrEqual(5);
	});

	test('uses KV when present and skips network', async () => {
		const stored = {
			models: [
				{
					id: 'cached/model',
					displayName: 'Cached',
					capabilities: { textToImage: true, imageToImage: false, edit: false },
					supportedQualities: ['1k'],
					supportedRatios: ['1:1'],
					pricing: { shape: 'per-image-flat', usd: 0.01 },
					fetchedAt: 0
				}
			],
			storedAt: Date.now()
		};
		const kv = {
			get: vi.fn().mockResolvedValue(stored),
			put: vi.fn().mockResolvedValue(undefined)
		};
		const { loadModels } = await import('./registry');
		const m = await loadModels({ env: { MODEL_CACHE: kv } });
		expect(modelsCalls).toBe(0);
		expect(m[0].id).toBe('cached/model');
		expect(kv.get).toHaveBeenCalledWith('openrouter:models:v1', { type: 'json' });
	});

	test('writes to KV after a network fetch', async () => {
		const kv = {
			get: vi.fn().mockResolvedValue(null),
			put: vi.fn().mockResolvedValue(undefined)
		};
		const { loadModels } = await import('./registry');
		await loadModels({ env: { MODEL_CACHE: kv } });
		expect(kv.put).toHaveBeenCalledOnce();
		expect(kv.put.mock.calls[0][0]).toBe('openrouter:models:v1');
	});
});
