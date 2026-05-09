import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { S3HttpStore } from './s3-http';

const ACCOUNT = 'acct123';
const ENDPOINT = `https://${ACCOUNT}.r2.cloudflarestorage.com`;

let lastReq: { headers: Headers } | null = null;
let lastBody: ArrayBuffer | null = null;

const server = setupServer(
	http.put(`${ENDPOINT}/:bucket/*`, async ({ request }) => {
		lastReq = request.clone();
		lastBody = await request.arrayBuffer();
		return new HttpResponse(null, { status: 200 });
	}),
	http.delete(`${ENDPOINT}/:bucket/*`, async ({ request }) => {
		lastReq = request.clone();
		return new HttpResponse(null, { status: 204 });
	})
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
	lastReq = null;
	lastBody = null;
	server.resetHandlers();
});
afterAll(() => server.close());

function makeStore() {
	return new S3HttpStore({
		accountId: ACCOUNT,
		accessKeyId: 'AKIAEXAMPLE',
		secretAccessKey: 'sekret',
		bucket: 'my-bucket'
	});
}

describe('S3HttpStore', () => {
	test('PUT signs requests with SigV4 and forwards content-type', async () => {
		const driver = makeStore();
		await driver.put('uploads/x.png', new Uint8Array([1, 2, 3]), { contentType: 'image/png' });
		expect(lastReq).not.toBeNull();
		expect(lastReq!.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256/);
		expect(lastReq!.headers.get('content-type')).toBe('image/png');
		expect(new Uint8Array(lastBody!)).toEqual(new Uint8Array([1, 2, 3]));
	});

	test('DELETE per-key signs requests', async () => {
		const driver = makeStore();
		await driver.delete(['uploads/a.png', 'uploads/b.png']);
		expect(lastReq).not.toBeNull();
		expect(lastReq!.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256/);
	});

	test('signedUrl includes X-Amz-Expires=300 and AWS4 signature', async () => {
		const driver = makeStore();
		const url = await driver.signedUrl('uploads/x.png', 300);
		expect(url).toContain('X-Amz-Expires=300');
		expect(url).toMatch(/X-Amz-Algorithm=AWS4-HMAC-SHA256/);
		expect(url).toMatch(/X-Amz-Signature=[0-9a-f]+/);
		expect(url).toContain(`${ENDPOINT}/my-bucket/uploads/x.png`);
	});

	test('publicUrl returns base+key when configured', () => {
		const driver = new S3HttpStore({
			accountId: ACCOUNT,
			accessKeyId: 'k',
			secretAccessKey: 's',
			bucket: 'b',
			publicBaseUrl: 'https://cdn.example/'
		});
		expect(driver.publicUrl('a/b.png')).toBe('https://cdn.example/a/b.png');
	});

	test('publicUrl throws when not configured', () => {
		expect(() => makeStore().publicUrl('a.png')).toThrow();
	});
});
