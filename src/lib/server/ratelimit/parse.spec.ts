import { describe, expect, test } from 'vitest';
import { parseRateSpec } from './parse';

describe('parseRateSpec', () => {
	test('parses /s, /m, /h, /d', () => {
		expect(parseRateSpec('60/s')).toEqual({ capacity: 60, refillPerSec: 60 });
		expect(parseRateSpec('60/m')).toEqual({ capacity: 60, refillPerSec: 1 });
		expect(parseRateSpec('600/h')).toEqual({ capacity: 600, refillPerSec: 600 / 3600 });
		expect(parseRateSpec('1/d')).toEqual({ capacity: 1, refillPerSec: 1 / 86400 });
	});

	test('throws on garbage', () => {
		expect(() => parseRateSpec('abc')).toThrow();
		expect(() => parseRateSpec('60')).toThrow();
		expect(() => parseRateSpec('-1/m')).toThrow();
		expect(() => parseRateSpec('')).toThrow();
		expect(() => parseRateSpec(undefined)).toThrow();
	});

	test('uses fallback when spec is missing or invalid', () => {
		const fb = { capacity: 10, refillPerSec: 1 };
		expect(parseRateSpec(undefined, fb)).toBe(fb);
		expect(parseRateSpec('garbage', fb)).toBe(fb);
		expect(parseRateSpec('', fb)).toBe(fb);
	});
});
