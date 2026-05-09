import { afterEach, describe, expect, test, vi } from 'vitest';

const deletedKeys: string[] = [];
let storageDeleteThrows = false;

vi.mock('$lib/server/storage', async () => {
	const keys = await import('$lib/server/storage/keys');
	return {
		...keys,
		storage: () => ({
			put: async () => {},
			delete: async (ks: string[]) => {
				if (storageDeleteThrows) throw new Error('R2 unavailable');
				for (const k of ks) deletedKeys.push(k);
			},
			signedUrl: async (k: string) => `https://signed.test/${encodeURIComponent(k)}`
		}),
		bulkDelete: async () => {}
	};
});

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { image as imageTbl } from '../db/schema';
import { seedUser } from '../db/queries/test-helpers';
import { seedImages } from './test-helpers';
import { deleteImage, getImage, listImages } from './queries';

afterEach(() => {
	deletedKeys.length = 0;
	storageDeleteThrows = false;
});

describe('library queries', () => {
	test('cursor pagination is stable across deletes', async () => {
		const u = await seedUser();
		const ids = await seedImages(u.id, 30);

		const page1 = await listImages(u.id, { limit: 10 });
		expect(page1.items.map((i) => i.id)).toEqual(ids.slice(0, 10));
		expect(page1.nextCursor).not.toBeNull();

		await deleteImage(u.id, ids[2]);

		const page2 = await listImages(u.id, { cursor: page1.nextCursor!, limit: 10 });
		expect(page2.items.map((i) => i.id)).toEqual(ids.slice(10, 20));
	});

	test('cannot read or delete another user image', async () => {
		const a = await seedUser();
		const b = await seedUser();
		const [imgA] = await seedImages(a.id, 1);

		const readErr = await getImage(b.id, imgA).catch((e: { status?: number }) => e);
		expect(readErr).toMatchObject({ status: 404 });

		const delErr = await deleteImage(b.id, imgA).catch((e: { status?: number }) => e);
		expect(delErr).toMatchObject({ status: 404 });
	});

	test('delete removes both DB row and R2 object', async () => {
		const u = await seedUser();
		const [id] = await seedImages(u.id, 1);
		const before = deletedKeys.length;

		await deleteImage(u.id, id);

		expect(deletedKeys.length).toBe(before + 1);
		const after = await getImage(u.id, id).catch((e: { status?: number }) => e);
		expect(after).toMatchObject({ status: 404 });
	});

	test('delete proceeds when R2 delete fails (orphan logged)', async () => {
		const u = await seedUser();
		const [id] = await seedImages(u.id, 1);

		storageDeleteThrows = true;
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await expect(deleteImage(u.id, id)).resolves.toBeUndefined();
		warn.mockRestore();

		const rows = await db.select().from(imageTbl).where(eq(imageTbl.id, id));
		expect(rows).toHaveLength(0);
	});

	test('listImages includes prompt/model/ratio from joined job', async () => {
		const u = await seedUser();
		await seedImages(u.id, 1);
		const { items } = await listImages(u.id, { limit: 10 });
		expect(items).toHaveLength(1);
		expect(items[0].prompt).toMatch(/^prompt-/);
		expect(items[0].modelId).toBe('test/model');
		expect(items[0].ratio).toBe('1:1');
		expect(items[0].quality).toBe('1k');
		expect(items[0].batchIndex).toBe(0);
	});

	test('listImages returns null nextCursor when fewer than limit+1 rows', async () => {
		const u = await seedUser();
		await seedImages(u.id, 3);
		const r = await listImages(u.id, { limit: 10 });
		expect(r.items).toHaveLength(3);
		expect(r.nextCursor).toBeNull();
	});

	test('cross-user listImages excludes other user rows', async () => {
		const a = await seedUser();
		const b = await seedUser();
		await seedImages(a.id, 5);
		await seedImages(b.id, 2);
		const r = await listImages(b.id, { limit: 50 });
		expect(r.items).toHaveLength(2);
	});
});
