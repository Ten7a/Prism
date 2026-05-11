import { shell, button } from './_layout';

export function verifyTemplate(_email: string, url: string) {
	const subject = 'Verify your Prism email';
	const html = shell(
		'Verify your email',
		`<p>Confirm this address to activate your Prism account.</p>${button(url, 'Verify email')}<p style="color:#8a8a8a">If you didn't sign up, ignore this email.</p>`
	);
	const text = `Verify your Prism email:\n${url}\n\nIf you didn't sign up, ignore this message.`;
	return { subject, html, text };
}
