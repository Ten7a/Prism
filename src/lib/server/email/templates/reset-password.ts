import { shell, button } from './_layout';

export function resetTemplate(_email: string, url: string) {
	const subject = 'Reset your Prism password';
	const html = shell(
		'Reset your password',
		`<p>Use the link below to set a new password. It expires in 1 hour.</p>${button(url, 'Reset password')}<p style="color:#8a8a8a">If you didn't request this, ignore this email.</p>`
	);
	const text = `Reset your Prism password:\n${url}\n\nLink expires in 1 hour. Ignore if you didn't request it.`;
	return { subject, html, text };
}
