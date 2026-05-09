import { describe, expect, test } from 'vitest';
import { sniffMatches } from './sniff';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const webp = new Uint8Array([
	0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50
]);
const txt = new Uint8Array([0x68, 0x69, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe('mime sniff', () => {
	test('matches PNG signature', () => {
		expect(sniffMatches(png, 'image/png')).toBe(true);
		expect(sniffMatches(png, 'image/jpeg')).toBe(false);
	});
	test('matches JPEG signature', () => {
		expect(sniffMatches(jpeg, 'image/jpeg')).toBe(true);
	});
	test('matches WebP signature', () => {
		expect(sniffMatches(webp, 'image/webp')).toBe(true);
	});
	test('rejects mismatched / non-image bytes', () => {
		expect(sniffMatches(txt, 'image/png')).toBe(false);
	});
	test('rejects too-short buffers', () => {
		expect(sniffMatches(new Uint8Array([0x89]), 'image/png')).toBe(false);
	});
});
