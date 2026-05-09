import { expect, test } from '@playwright/test';
import { readdir, readFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const OUTBOX = process.env.EMAIL_OUTBOX_DIR;
const HAS_R2 =
	!!process.env.R2_ACCOUNT_ID &&
	!!process.env.R2_ACCESS_KEY_ID &&
	!!process.env.R2_SECRET_ACCESS_KEY &&
	!!process.env.R2_BUCKET;

// Minimal valid 1x1 PNG (8-byte signature + IHDR + IDAT + IEND).
const PNG_BYTES = Buffer.from(
	'89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0c0c00000000500010d0a2db40000000049454e44ae426082',
	'hex'
);

async function waitForVerifyEmail(email: string, timeoutMs = 5000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const files = (await readdir(OUTBOX!)).filter((f) => f.includes(encodeURIComponent(email)));
		for (const f of files) {
			const body = JSON.parse(await readFile(join(OUTBOX!, f), 'utf-8'));
			const m = body.text.match(/https?:\/\/\S+/);
			if (m) return m[0];
		}
		await new Promise((r) => setTimeout(r, 100));
	}
	throw new Error(`No verify email arrived for ${email}`);
}

async function signupAndLogin(page: any, email: string, password: string) {
	await page.goto('/signup');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign up' }).click();
	await expect(page.getByText(/account created/i)).toBeVisible();

	const url = await waitForVerifyEmail(email);
	await page.goto(url);

	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/account/);
}

test.describe('uploads', () => {
	test.skip(!process.env.DATABASE_URL, 'DATABASE_URL not set');
	test.skip(!OUTBOX, 'EMAIL_OUTBOX_DIR not set');
	test.skip(!HAS_R2, 'R2 env not configured');

	test.beforeEach(async () => {
		if (OUTBOX) {
			await rm(OUTBOX, { recursive: true, force: true });
			await mkdir(OUTBOX, { recursive: true });
		}
	});

	test('reference-image upload happy path', async ({ page, request }) => {
		const email = `e2e-up-${Date.now()}@prism.test`;
		await signupAndLogin(page, email, 'correct-horse-battery');

		const res = await request.post('/api/uploads', {
			multipart: {
				file: { name: 'a.png', mimeType: 'image/png', buffer: PNG_BYTES }
			}
		});
		expect(res.status()).toBe(200);
		const { key, url } = await res.json();
		expect(key).toMatch(/^uploads\//);
		const fetched = await request.get(url);
		expect(fetched.status()).toBe(200);
	});

	test('rejects 11MB upload', async ({ page, request }) => {
		const email = `e2e-up-big-${Date.now()}@prism.test`;
		await signupAndLogin(page, email, 'correct-horse-battery');

		const big = Buffer.alloc(11 * 1024 * 1024, 0);
		const res = await request.post('/api/uploads', {
			multipart: {
				file: { name: 'big.png', mimeType: 'image/png', buffer: big }
			}
		});
		expect(res.status()).toBe(413);
	});

	test('rejects non-image mime', async ({ page, request }) => {
		const email = `e2e-up-bad-${Date.now()}@prism.test`;
		await signupAndLogin(page, email, 'correct-horse-battery');

		const res = await request.post('/api/uploads', {
			multipart: {
				file: { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') }
			}
		});
		expect(res.status()).toBe(415);
	});

	test('unauthenticated upload is rejected', async ({ request }) => {
		const res = await request.post('/api/uploads', {
			multipart: {
				file: { name: 'a.png', mimeType: 'image/png', buffer: PNG_BYTES }
			}
		});
		expect(res.status()).toBe(401);
	});

	test('cross-user image id returns 404 (not 403)', async ({ page, request }) => {
		const email = `e2e-up-x-${Date.now()}@prism.test`;
		await signupAndLogin(page, email, 'correct-horse-battery');

		// Random valid-shape uuid that the user does not own.
		const fakeId = '00000000-0000-4000-8000-000000000000';
		const res = await request.get(`/api/images/${fakeId}`, { maxRedirects: 0 });
		expect(res.status()).toBe(404);
	});
});
