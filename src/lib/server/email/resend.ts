import { env } from '$env/dynamic/private';
import { Resend } from 'resend';
import nodemailer, { type Transporter } from 'nodemailer';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const EMAIL_FROM = env.EMAIL_FROM || 'Prism <noreply@prism.test>';

type Mail = { to: string; subject: string; html: string; text: string };

let resend: Resend | null = null;
let smtp: Transporter | null = null;

function transport() {
	if (env.EMAIL_OUTBOX_DIR) {
		return { kind: 'outbox' as const, dir: env.EMAIL_OUTBOX_DIR };
	}
	if (env.RESEND_API_KEY) {
		resend ??= new Resend(env.RESEND_API_KEY);
		return { kind: 'resend' as const, client: resend };
	}
	if (env.SMTP_URL) {
		smtp ??= nodemailer.createTransport(env.SMTP_URL);
		return { kind: 'smtp' as const, client: smtp };
	}
	return null;
}

export async function sendMail({ to, subject, html, text }: Mail): Promise<void> {
	const t = transport();
	if (!t) {
		throw new Error('No email transport configured: set RESEND_API_KEY or SMTP_URL');
	}
	if (t.kind === 'outbox') {
		await mkdir(t.dir, { recursive: true });
		const file = join(t.dir, `${Date.now()}-${encodeURIComponent(to)}.json`);
		await writeFile(file, JSON.stringify({ from: EMAIL_FROM, to, subject, html, text }, null, 2));
		return;
	}
	if (t.kind === 'resend') {
		const { error } = await t.client.emails.send({ from: EMAIL_FROM, to, subject, html, text });
		if (error) throw new Error(`Resend error: ${error.message}`);
		return;
	}
	await t.client.sendMail({ from: EMAIL_FROM, to, subject, html, text });
}
