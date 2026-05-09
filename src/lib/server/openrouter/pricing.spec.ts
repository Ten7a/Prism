import { describe, expect, test } from 'vitest';
import { estimateCost, inferShape, normalise } from './pricing';
import { USD_PER_TOKEN, type ModelEntry, type PricingShape } from './types';

function mock(pricing: PricingShape, id = 'mock/model'): ModelEntry {
	return {
		id,
		displayName: id,
		capabilities: { textToImage: true, imageToImage: false, edit: false },
		supportedQualities: ['1k', '2k', '4k'],
		supportedRatios: ['1:1'],
		pricing,
		fetchedAt: 0
	};
}

describe('estimateCost', () => {
	test('per-image-flat: seedream batch=4 = ceil(4 * 0.04 / 0.01) tokens', () => {
		const m = mock({ shape: 'per-image-flat', usd: 0.04 }, 'bytedance-seed/seedream-4.5');
		const out = estimateCost(m, { quality: '1k', ratio: '1:1', batch: 4 });
		expect(out.usdEstimate).toBeCloseTo(0.16, 5);
		expect(out.internalTokens).toBe(Math.ceil((0.04 * 4) / USD_PER_TOKEN));
	});

	test('per-mp: flux.2-pro at 2k (≈4MP) batch=1 = first + 3*subsequent', () => {
		const m = mock(
			{ shape: 'per-mp', firstUsd: 0.03, subsequentUsd: 0.015 },
			'black-forest-labs/flux.2-pro'
		);
		const out = estimateCost(m, { quality: '2k', ratio: '1:1', batch: 1 });
		expect(out.usdEstimate).toBeCloseTo(0.03 + 3 * 0.015, 5);
	});

	test('per-token: gemini flash 4k > 1k (output tokens scale with quality)', () => {
		const m = mock(
			{ shape: 'per-token', inUsd: 0.0000003, outUsd: 0.0000025 },
			'google/gemini-2.5-flash-image'
		);
		const c1 = estimateCost(m, { quality: '1k', ratio: '1:1', batch: 1 });
		const c4 = estimateCost(m, { quality: '4k', ratio: '1:1', batch: 1 });
		expect(c4.usdEstimate).toBeGreaterThan(c1.usdEstimate);
	});

	test('per-image-tier: riverflow pro > fast at same batch', () => {
		const fast = mock(
			{ shape: 'per-image-tier', tiers: { fast: 0.01 } },
			'sourceful/riverflow-v2-fast'
		);
		const pro = mock(
			{ shape: 'per-image-tier', tiers: { pro: 0.04 } },
			'sourceful/riverflow-v2-pro'
		);
		const a = estimateCost(fast, { quality: '1k', ratio: '1:1', batch: 2 });
		const b = estimateCost(pro, { quality: '1k', ratio: '1:1', batch: 2 });
		expect(b.usdEstimate).toBeGreaterThan(a.usdEstimate);
		expect(a.internalTokens).toBe(Math.ceil((0.01 * 2) / USD_PER_TOKEN));
	});
});

describe('inferShape / normalise', () => {
	test('flux IDs become per-mp', () => {
		const shape = inferShape({ id: 'black-forest-labs/flux.2-pro', pricing: { image: 0.04 } });
		expect(shape.shape).toBe('per-mp');
	});

	test('gemini IDs become per-token', () => {
		const shape = inferShape({
			id: 'google/gemini-2.5-flash-image',
			pricing: { prompt: 0.0000003, completion: 0.0000025 }
		});
		expect(shape.shape).toBe('per-token');
	});

	test('riverflow IDs become per-image-tier', () => {
		const shape = inferShape({
			id: 'sourceful/riverflow-v2-pro',
			pricing: { image: 0.04 }
		});
		expect(shape.shape).toBe('per-image-tier');
	});

	test('normalise marks image-input models as imageToImage capable', () => {
		const m = normalise({
			id: 'google/gemini-2.5-flash-image',
			input_modalities: ['text', 'image'],
			pricing: { prompt: 0.0000003, completion: 0.0000025 }
		});
		expect(m.capabilities.imageToImage).toBe(true);
		expect(m.capabilities.edit).toBe(true);
	});
});
