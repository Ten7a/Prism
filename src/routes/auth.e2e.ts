import { expect, test } from '@playwright/test';
import { readdir, readFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const OUTBOX = process.env.EMAIL_OUTBOX_DIR;

test.describe('auth flow', () => {
	test.skip(!OUTBOX, 'EMAIL_OUTBOX_DIR not set; skipping flow tests');
	test.skip(!process.env.DATABASE_URL, 'DATABASE_URL not set; skipping flow tests');

	test.beforeEach(async () => {
		if (OUTBOX) {
			await rm(OUTBOX, { recursive: true, force: true });
			await mkdir(OUTBOX, { recursive: true });
		}
	});

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

	test('signup -> verify -> /account', async ({ page }) => {
		const email = `e2e-${Date.now()}@prism.test`;
		const password = 'correct-horse-battery';

		await page.goto('/signup');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill(password);
		await page.getByRole('button', { name: 'Sign up' }).click();
		await expect(page.getByText(/account created/i)).toBeVisible();

		const url = await waitForVerifyEmail(email);
		await page.goto(url);
		// Better Auth's verify endpoint redirects to /verify; expect a verified state.
		await expect(page).toHaveURL(/\/verify|\/account/);

		await page.goto('/login');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill(password);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page).toHaveURL(/\/account/);
		await expect(page.getByText(email)).toBeVisible();
	});

	test('login rejects unverified accounts and exposes resend', async ({ page }) => {
		const email = `e2e-unv-${Date.now()}@prism.test`;
		const password = 'correct-horse-battery';

		await page.goto('/signup');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill(password);
		await page.getByRole('button', { name: 'Sign up' }).click();
		await expect(page.getByText(/account created/i)).toBeVisible();

		await page.goto('/login');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill(password);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page.getByRole('button', { name: /resend verification/i })).toBeVisible();
	});
});
