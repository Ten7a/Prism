import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const RESEND_KEY = 're_test_dummy';
process.env.RESEND_API_KEY = RESEND_KEY;
process.env.EMAIL_FROM = 'Prism <test@prism.test>';

vi.mock('$env/dynamic/private', () => ({ env: process.env }));

let lastResendBody: any = null;

const server = setupServer(
	http.post('https://api.resend.com/emails', async ({ request }) => {
		lastResendBody = await request.json();
		return HttpResponse.json({ id: 'mock-message-id' });
	})
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
	lastResendBody = null;
	server.resetHandlers();
});
afterAll(() => server.close());

describe('email transport', () => {
	test('verify-email template includes the verify URL', async () => {
		const { sendMail } = await import('./resend');
		const { verifyTemplate } = await import('./templates/verify-email');

		await sendMail({ to: 'a@b.test', ...verifyTemplate('a@b.test', 'https://x/y?t=abc') });

		expect(lastResendBody).not.toBeNull();
		expect(lastResendBody.from).toContain('Prism');
		expect(lastResendBody.to).toBe('a@b.test');
		expect(lastResendBody.subject.toLowerCase()).toContain('verify');
		expect(lastResendBody.html).toContain('https://x/y?t=abc');
		expect(lastResendBody.text).toContain('https://x/y?t=abc');
	});

	test('reset-password template includes the reset URL', async () => {
		const { sendMail } = await import('./resend');
		const { resetTemplate } = await import('./templates/reset-password');

		await sendMail({ to: 'u@b.test', ...resetTemplate('u@b.test', 'https://x/reset?t=zzz') });

		expect(lastResendBody.html).toContain('https://x/reset?t=zzz');
	});

	test('falls back to SMTP when RESEND_API_KEY is unset', async () => {
		vi.resetModules();
		const sendMailSpy = vi.fn().mockResolvedValue({});
		vi.doMock('nodemailer', () => ({
			default: { createTransport: () => ({ sendMail: sendMailSpy }) }
		}));
		const prevKey = process.env.RESEND_API_KEY;
		const prevSmtp = process.env.SMTP_URL;
		delete process.env.RESEND_API_KEY;
		process.env.SMTP_URL = 'smtp://user:pass@localhost:1025';

		try {
			const { sendMail } = await import('./resend');
			await sendMail({ to: 'a@b.test', subject: 's', html: '<p>h</p>', text: 't' });
			expect(sendMailSpy).toHaveBeenCalledOnce();
			expect(sendMailSpy.mock.calls[0][0].to).toBe('a@b.test');
		} finally {
			process.env.RESEND_API_KEY = prevKey;
			if (prevSmtp === undefined) delete process.env.SMTP_URL;
			else process.env.SMTP_URL = prevSmtp;
			vi.doUnmock('nodemailer');
			vi.resetModules();
		}
	});
});
