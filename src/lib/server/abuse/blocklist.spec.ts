import { describe, expect, test } from 'vitest';
import { isBlocked, _BLOCKED_TERMS_FOR_TESTS } from './blocklist';

describe('blocklist', () => {
	test('matches a blocked term as a standalone word', () => {
		const term = _BLOCKED_TERMS_FOR_TESTS[0];
		expect(isBlocked(`hello ${term} world`).blocked).toBe(true);
		expect(isBlocked(term.toUpperCase()).blocked).toBe(true);
	});

	test('does NOT match when blocked letters appear inside a longer benign word', () => {
		// e.g. "csam" inside "doccsamble" should not match — word-boundary regex.
		const term = _BLOCKED_TERMS_FOR_TESTS[0];
		const benign = `doc${term}ble`;
		expect(isBlocked(benign).blocked).toBe(false);
	});

	test('returns matched term for diagnostics', () => {
		const term = _BLOCKED_TERMS_FOR_TESTS[0];
		expect(isBlocked(`a ${term} b`).matched).toBe(term);
	});

	test('benign prompts pass', () => {
		expect(isBlocked('a watercolor painting of a cat').blocked).toBe(false);
		expect(isBlocked('').blocked).toBe(false);
	});
});
