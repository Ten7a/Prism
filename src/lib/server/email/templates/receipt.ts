import { shell, button } from './_layout';

export function receiptTemplate(
	_email: string,
	args: { amountCents: number; tokens: number; invoiceUrl?: string }
) {
	const dollars = (args.amountCents / 100).toFixed(2);
	const subject = `Prism receipt — $${dollars}`;
	const html = shell(
		'Receipt',
		`<p>Thanks for your purchase.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:12px">
<tr><td style="color:#8a8a8a;padding-right:24px">Amount</td><td>$${dollars}</td></tr>
<tr><td style="color:#8a8a8a;padding-right:24px">Tokens</td><td>${args.tokens}</td></tr>
</table>
${args.invoiceUrl ? button(args.invoiceUrl, 'View invoice') : ''}`
	);
	const text = `Prism receipt — $${dollars}\nTokens: ${args.tokens}${args.invoiceUrl ? `\nInvoice: ${args.invoiceUrl}` : ''}`;
	return { subject, html, text };
}
