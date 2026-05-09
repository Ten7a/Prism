import { describe, expect, test } from 'vitest';
import { getCurrentConsent, listConsents, upsertConsent } from './store';
import { seedUser } from '../db/queries/test-helpers';

describe('consent store', () => {
	test('getCurrentConsent returns the latest persisted state for a signed-in user', async () => {
		const u = await seedUser();
		await upsertConsent({
			userId: u.id,
			version: 'v1',
			necessary: true,
			analytics: true,
			ads: false
		});
		const row = await getCurrentConsent({ userId: u.id });
		expect(row).toMatchObject({ analytics: true, ads: false, version: 'v1' });
	});

	test('upsert keyed by anon cookie preserves history for unauthenticated visitors', async () => {
		const anonId = `anon_${crypto.randomUUID()}`;
		await upsertConsent({
			anonId,
			version: 'v1',
			necessary: true,
			analytics: false,
			ads: false
		});
		await upsertConsent({
			anonId,
			version: 'v1',
			necessary: true,
			analytics: true,
			ads: true
		});
		const rows = await listConsents({ anonId });
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({ analytics: true, ads: true });
		expect(rows[1]).toMatchObject({ analytics: false, ads: false });
	});

	test('upsertConsent rejects when no identity is provided', async () => {
		await expect(
			upsertConsent({ version: 'v1', necessary: true, analytics: false, ads: false })
		).rejects.toThrow();
	});

	test('signed-in identity does not surface anon rows', async () => {
		const u = await seedUser();
		const anonId = `anon_${crypto.randomUUID()}`;
		await upsertConsent({ anonId, version: 'v1', necessary: true, analytics: true, ads: true });
		await upsertConsent({
			userId: u.id,
			version: 'v1',
			necessary: true,
			analytics: false,
			ads: false
		});
		const userRows = await listConsents({ userId: u.id });
		expect(userRows).toHaveLength(1);
		expect(userRows[0]).toMatchObject({ analytics: false, ads: false });
		const anonRows = await listConsents({ anonId });
		expect(anonRows).toHaveLength(1);
	});
});
