import { describe, expect, test } from 'vitest';
import { uploadKey, imageKey } from './keys';

describe('storage keys', () => {
	test('upload key includes only the validated extension', () => {
		expect(uploadKey('user_1', 'image/png')).toMatch(
			/^uploads\/user_1\/[0-9a-f-]{36}\.png$/
		);
		expect(uploadKey('user_1', 'image/jpeg')).toMatch(
			/^uploads\/user_1\/[0-9a-f-]{36}\.jpg$/
		);
		expect(uploadKey('user_1', 'image/webp')).toMatch(
			/^uploads\/user_1\/[0-9a-f-]{36}\.webp$/
		);
	});

	test('rejects path-traversal-shaped extensions', () => {
		expect(() => uploadKey('user_1', 'image/png\0../evil')).toThrow();
		expect(() => uploadKey('user_1', 'image/svg+xml')).toThrow();
		expect(() => uploadKey('user_1', '')).toThrow();
	});

	test('image key shape', () => {
		expect(imageKey('user_1', 'job-abc', 0)).toBe('images/user_1/job-abc/0.png');
	});
});
