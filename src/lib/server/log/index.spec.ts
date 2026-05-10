import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { baseLog, serialiseError } from './index';

function capture(fn: () => void): string {
	const lines: string[] = [];
	const spy = vi.spyOn(console, 'log').mockImplementation((line: string) => {
		lines.push(String(line));
	});
	try {
		fn();
	} finally {
		spy.mockRestore();
	}
	return lines.join('\n');
}

describe('logger', () => {
	const prevLevel = process.env.LOG_LEVEL;
	beforeEach(() => {
		process.env.LOG_LEVEL = 'debug';
	});
	afterEach(() => {
		process.env.LOG_LEVEL = prevLevel;
	});

	test('emits JSON line with bindings + msg', () => {
		const out = capture(() => baseLog.info({ a: 1 }, 'hello'));
		const parsed = JSON.parse(out);
		expect(parsed).toMatchObject({ level: 'info', msg: 'hello', a: 1 });
		expect(typeof parsed.ts).toBe('string');
	});

	test('child merges bindings; never mutates parent', () => {
		const c = baseLog.child({ userId: 'u1' });
		const childOut = capture(() => c.info({}, 'x'));
		expect(JSON.parse(childOut)).toMatchObject({ userId: 'u1', msg: 'x' });
		const parentOut = capture(() => baseLog.info({}, 'x'));
		expect(parentOut).not.toContain('u1');
	});

	test('respects LOG_LEVEL=warn — info is dropped', () => {
		process.env.LOG_LEVEL = 'warn';
		expect(capture(() => baseLog.info({}, 'x'))).toBe('');
		expect(capture(() => baseLog.warn({}, 'x'))).not.toBe('');
	});

	test('serialiseError extracts name/message/stack', () => {
		const e = new TypeError('boom');
		const ser = serialiseError(e);
		expect(ser.name).toBe('TypeError');
		expect(ser.message).toBe('boom');
		expect(ser.stack).toBeTruthy();
	});

	test('serialiseError handles non-Error', () => {
		expect(serialiseError('plain')).toEqual({ name: 'NonError', message: 'plain' });
	});
});
