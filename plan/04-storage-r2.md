# 04 — Storage (Cloudflare R2)

## Goal

Stand up the storage layer for Prism: a thin R2 client that works against a Worker R2 binding _and_ an HTTP S3 endpoint (so self-hosters with `adapter-node` can use any S3-compatible store), an authenticated reference-image upload endpoint, and signed-URL helpers for serving generated images.

## Touches

- `src/lib/server/storage/types.ts` — provider-agnostic interface.
- `src/lib/server/storage/r2-binding.ts` — uses `platform.env.R2` (Workers).
- `src/lib/server/storage/s3-http.ts` — `aws4fetch`-based driver for Node/self-host.
- `src/lib/server/storage/index.ts` — `storage()` factory that picks the right driver.
- `src/lib/server/storage/keys.ts` — key builders (`uploads/{userId}/{uuid}.{ext}`, `images/{userId}/{jobId}/{idx}.png`).
- `src/routes/api/uploads/+server.ts` — `POST` reference image upload.
- `src/routes/api/images/[id]/+server.ts` — `GET` 302-redirect to a 5-min signed URL.
- `.env.example` — `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` (optional CDN), `STORAGE_DRIVER=r2|s3`.

## Reuses

- `aws4fetch` (1KB) for SigV4 — works everywhere `fetch` does.
- Auth from step 02 (`event.locals.user`).
- `image` table from step 01.

## Provider interface

```ts
export interface ObjectStore {
	put(
		key: string,
		body: ArrayBuffer | ReadableStream,
		opts: { contentType: string }
	): Promise<void>;
	delete(keys: string[]): Promise<void>;
	signedUrl(key: string, expiresInSec: number): Promise<string>;
	publicUrl?(key: string): string; // when R2_PUBLIC_BASE_URL is set
}
```

## Steps

1. Implement `r2-binding.ts` for Workers — uses `bucket.put`, `bucket.delete`, and `bucket.createPresignedUrl` (or fall back to the S3 endpoint with SigV4 if presigned URLs aren't supported in the binding).
2. Implement `s3-http.ts` using `aws4fetch`:

   ```ts
   const { fetch: awsFetch } = new AwsClient({ accessKeyId, secretAccessKey, service: 's3' });
   // PUT / DELETE / GET against `${endpoint}/${bucket}/${key}`
   // for signed URL: build canonical query, sign, return URL string
   ```

3. `index.ts` factory: switch on `STORAGE_DRIVER` and the presence of `platform.env.R2`.
4. `keys.ts` — opaque, deterministic key builders. **Never** include user-supplied filenames; use UUIDs + extension derived from validated mime.
5. `/api/uploads`:
   - Auth required.
   - Multipart parse via `request.formData()`.
   - Validate: mime ∈ `{image/png, image/jpeg, image/webp}`, size ≤ 10MB, magic-byte sniff (first 16 bytes must match the claimed mime).
   - Per-user rate limit: 30 uploads / hour (placeholder; real limit lands in step 12).
   - Write to R2, return `{ key, url }` (signed for 5 min so the user can preview).
6. `/api/images/[id]`:
   - Look up `image` by id, assert `image.userId === locals.user.id`.
   - Issue a 302 to a 5-min signed URL (or to `R2_PUBLIC_BASE_URL/{key}` when configured + image is marked public).

## Tests

`src/lib/server/storage/keys.spec.ts`:

```ts
test('upload key includes only the validated extension', () => {
	expect(uploadKey('user_1', 'image/png')).toMatch(/^uploads\/user_1\/[0-9a-f-]{36}\.png$/);
});
test('rejects path-traversal-shaped extensions', () => {
	expect(() => uploadKey('user_1', 'image/png\0../evil')).toThrow();
});
```

`src/lib/server/storage/s3-http.spec.ts` (msw):

```ts
test('PUT signs requests with SigV4', async () => {
	await driver.put('uploads/x.png', new Uint8Array([1]), { contentType: 'image/png' });
	expect(lastReq().headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256/);
});
test('signedUrl includes X-Amz-Expires=300', async () => {
	const url = await driver.signedUrl('uploads/x.png', 300);
	expect(url).toContain('X-Amz-Expires=300');
});
```

`e2e/uploads.test.ts`:

```ts
test('reference-image upload happy path', async ({ page, request }) => {
	await loginAs(page, 'e2e@prism.test');
	const res = await request.post('/api/uploads', {
		multipart: { file: { name: 'a.png', mimeType: 'image/png', buffer: pngBytes } }
	});
	expect(res.status()).toBe(200);
	const { key, url } = await res.json();
	expect(key).toMatch(/^uploads\//);
	expect(await (await fetch(url)).status).toBe(200);
});

test('rejects 11MB upload', async ({ request }) => {
	const big = Buffer.alloc(11 * 1024 * 1024, 0);
	const res = await request.post('/api/uploads', {
		multipart: { file: { name: 'big.png', mimeType: 'image/png', buffer: big } }
	});
	expect(res.status()).toBe(413);
});

test('rejects non-image mime', async ({ request }) => {
	const res = await request.post('/api/uploads', {
		multipart: { file: { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') } }
	});
	expect(res.status()).toBe(415);
});
```

Edge case: another user's image id returns 404 (not 403, to avoid id enumeration).

## Verify

```bash
npm run check
npm run test:unit -- --run src/lib/server/storage
npm run test:e2e -- e2e/uploads.test.ts
```

Manual: create an R2 bucket + access key, set env, `npm run dev`, drop an image into the upload box on the Generate page (built in step 05), confirm preview renders.
