# 06 — Library

## Goal

The user's image archive: a virtualised infinite-scroll grid, a detail page with full metadata + actions (download, delete, remix prompt, use as reference), and stable cursor pagination.

## Touches

- `src/routes/library/+page.server.ts` — initial page load (first 24).
- `src/routes/library/+page.svelte` — grid + observer-based pagination.
- `src/routes/library/[id]/+page.server.ts` + `+page.svelte` — detail.
- `src/routes/api/library/+server.ts` — `GET ?cursor=…&limit=24`.
- `src/routes/api/library/[id]/+server.ts` — `DELETE`.
- `src/lib/server/library/queries.ts` — `listImages`, `getImage`, `deleteImage`.
- `src/lib/components/ImageTile.svelte` — square thumbnail with hover overlay.

## Reuses

- `image` and `generation_job` tables from step 01.
- `storage().delete` from step 04.
- `/api/images/[id]` signed-URL redirector from step 04.
- `RuleRow` / `Chip` components (formalised in step 11).

## Cursor design

`cursor = base64({ createdAt: ISO, id: uuid })`. Query:

```sql
WHERE user_id = $1
  AND (created_at, id) < ($cursorCreatedAt, $cursorId)
ORDER BY created_at DESC, id DESC
LIMIT $limit
```

This keeps pagination stable across deletes (deleted rows don't shift the window).

## Steps

1. `library/queries.ts:listImages(userId, { cursor, limit })` — joins `image` ↔ `generation_job` for prompt/model/ratio in one query; returns `{ items, nextCursor }`.
2. `/api/library` GET — validates limit (≤ 60), calls `listImages`, returns JSON.
3. `/api/library/[id]` DELETE:
   - Look up + assert ownership (404 on miss).
   - `await storage().delete([image.r2_key])`.
   - `await db.delete(image).where(eq(image.id, id))`.
   - Note: keeps the `generation_job` row (audit trail).
4. `/library` page:
   - Initial 24 from `+page.server.ts`.
   - `IntersectionObserver` on a sentinel below the grid → fetch next page.
   - Each `ImageTile` shows the image (via `/api/images/{id}`), with model badge + ratio chip on hover.
5. `/library/[id]` page:
   - Full image (signed for 1h), prompt, model, ratio, quality, batch index, generated-at.
   - Buttons: **Download** (anchor with `download` attr to public/signed URL), **Remix prompt** (link to `/generate?seed={jobId}`), **Use as reference** (uploads same key as a reference for next generation), **Delete** (calls DELETE, redirects to `/library`).

## Tests

`src/lib/server/library/queries.spec.ts`:

```ts
test('cursor pagination is stable across deletes', async () => {
	const u = await seedUser();
	const ids = await seedImages(u.id, 30); // ordered by createdAt desc, id desc
	const page1 = await listImages(u.id, { limit: 10 });
	expect(page1.items.map((i) => i.id)).toEqual(ids.slice(0, 10));
	await deleteImage(u.id, ids[2]); // delete an item already returned
	const page2 = await listImages(u.id, { cursor: page1.nextCursor, limit: 10 });
	expect(page2.items.map((i) => i.id)).toEqual(ids.slice(10, 20));
});

test('cannot read or delete another user image', async () => {
	const a = await seedUser(),
		b = await seedUser();
	const [imgA] = await seedImages(a.id, 1);
	await expect(getImage(b.id, imgA)).rejects.toMatchObject({ status: 404 });
	await expect(deleteImage(b.id, imgA)).rejects.toMatchObject({ status: 404 });
});

test('delete removes both DB row and R2 object', async () => {
	const u = await seedUser();
	const [id] = await seedImages(u.id, 1);
	const before = mockStorage.deletedKeys.length;
	await deleteImage(u.id, id);
	expect(mockStorage.deletedKeys.length).toBe(before + 1);
	expect(await getImage(u.id, id).catch((e) => e.status)).toBe(404);
});
```

`e2e/library.test.ts`:

```ts
test('library shows generated images and supports infinite scroll', async ({ page }) => {
	await loginAs(page, 'e2e@prism.test');
	await seedJobsAndImages(30);
	await page.goto('/library');
	await expect(page.locator('[data-testid="image-tile"]')).toHaveCount(24);
	await page.mouse.wheel(0, 5000);
	await expect(page.locator('[data-testid="image-tile"]')).toHaveCount(30);
});

test('detail page deletes image and returns to grid', async ({ page }) => {
	// …
});
```

Edge case: on Cloudflare R2 delete failure, the DB delete still proceeds but a `library_orphan_key` row is enqueued for later sweep (logged via step 13 logger). Test: stub R2 delete to throw → assert DB row is gone and an orphan record exists.

## Verify

```bash
npm run check
npm run test:unit -- --run src/lib/server/library
npm run test:e2e -- e2e/library.test.ts
npm run dev   # browse /library, scroll, open detail, download, delete
```

Acceptance: 30 generations paginate as 24 + 6, deletes don't break pagination, only the owner can fetch or delete an image.
