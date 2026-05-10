import { describe, expect, test, vi } from 'vitest';

process.env.OPENROUTER_API_KEY = 'or_test_dummy';
process.env.OPENROUTER_BASE_URL = 'https://openrouter.test/api/v1';
vi.mock('$env/dynamic/private', () => ({ env: process.env }));

import { buildRequest, parseImages, qualityToSize } from './generate';
import type { ModelEntry } from './types';

const geminiModel: ModelEntry = {
	id: 'google/gemini-2.5-flash-image',
	displayName: 'Gemini',
	capabilities: { textToImage: true, imageToImage: true, edit: true },
	supportedQualities: ['1k', '2k', '4k'],
	supportedRatios: ['1:1', '16:9'],
	pricing: { shape: 'per-token', inUsd: 0.000003, outUsd: 0.000025 },
	fetchedAt: 0
};

const seedreamModel: ModelEntry = {
	id: 'bytedance-seed/seedream-4.5',
	displayName: 'Seedream',
	capabilities: { textToImage: true, imageToImage: true, edit: true },
	supportedQualities: ['1k', '2k', '4k'],
	supportedRatios: ['1:1', '16:9'],
	pricing: { shape: 'per-image-flat', usd: 0.04 },
	fetchedAt: 0
};

const fluxModel: ModelEntry = {
	id: 'black-forest-labs/flux.2-pro',
	displayName: 'Flux',
	capabilities: { textToImage: true, imageToImage: false, edit: false },
	supportedQualities: ['1k', '2k', '4k'],
	supportedRatios: ['1:1'],
	pricing: { shape: 'per-mp', firstUsd: 0.03, subsequentUsd: 0.015 },
	fetchedAt: 0
};

describe('qualityToSize', () => {
	test('1k 1:1 ≈ 1024x1024', () => {
		const { width, height } = qualityToSize('1k', '1:1');
		expect(width).toBe(height);
		expect(Math.abs(width - 1024)).toBeLessThan(80);
	});

	test('1k 16:9 ratio is wider than tall', () => {
		const { width, height } = qualityToSize('1k', '16:9');
		expect(width).toBeGreaterThan(height);
	});
});

describe('buildRequest', () => {
	test('per-token model → /chat/completions with modalities', () => {
		const r = buildRequest(geminiModel, { prompt: 'hi', quality: '1k', ratio: '1:1' });
		expect(r.url).toBe('/chat/completions');
		const body = JSON.parse(r.init.body as string);
		expect(body.model).toBe(geminiModel.id);
		expect(body.modalities).toEqual(['image', 'text']);
		expect(body.messages[0].content[0]).toEqual({ type: 'text', text: 'hi' });
	});

	test('per-token model includes ref images as image_url parts', () => {
		const r = buildRequest(geminiModel, {
			prompt: 'hi',
			quality: '1k',
			ratio: '1:1',
			refImageUrls: ['https://x/y.png']
		});
		const body = JSON.parse(r.init.body as string);
		expect(body.messages[0].content[1]).toEqual({
			type: 'image_url',
			image_url: { url: 'https://x/y.png' }
		});
	});

	test('per-image-flat model → /images/generations with size & n', () => {
		const r = buildRequest(seedreamModel, { prompt: 'cat', quality: '1k', ratio: '1:1' });
		expect(r.url).toBe('/images/generations');
		const body = JSON.parse(r.init.body as string);
		expect(body.model).toBe(seedreamModel.id);
		expect(body.prompt).toBe('cat');
		expect(body.n).toBe(1);
		expect(body.size).toMatch(/\d+x\d+/);
	});

	test('per-mp model → /images/generations', () => {
		const r = buildRequest(fluxModel, { prompt: 'cat', quality: '2k', ratio: '1:1' });
		expect(r.url).toBe('/images/generations');
	});
});

function makeResponse(json: unknown): Response {
	return new Response(JSON.stringify(json), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
}

describe('parseImages', () => {
	test('chat shape extracts base64 from message.images', async () => {
		const png1x1 =
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
		const res = makeResponse({
			choices: [
				{
					message: {
						images: [{ image_url: { url: `data:image/png;base64,${png1x1}` } }]
					}
				}
			]
		});
		const out = await parseImages(res, geminiModel, { width: 1024, height: 1024 });
		expect(out).toHaveLength(1);
		expect(out[0].mime).toBe('image/png');
		expect(out[0].bytes.byteLength).toBeGreaterThan(0);
	});

	test('images shape extracts b64_json', async () => {
		const png1x1 =
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
		const res = makeResponse({ data: [{ b64_json: png1x1 }] });
		const out = await parseImages(res, seedreamModel, { width: 1024, height: 1024 });
		expect(out).toHaveLength(1);
		expect(out[0].bytes.byteLength).toBeGreaterThan(0);
	});

	test('throws if response has no images', async () => {
		const res = makeResponse({ data: [] });
		await expect(parseImages(res, seedreamModel, { width: 64, height: 64 })).rejects.toThrow();
	});
});
