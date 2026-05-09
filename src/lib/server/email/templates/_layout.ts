export function shell(title: string, body: string): string {
	return `<!doctype html><html><body style="margin:0;background:#000;color:#e8e8e8;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;line-height:1.6;padding:32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;border:1px solid #1c1c1c"><tr><td style="padding:28px">
<div style="font-size:11px;letter-spacing:0.2em;color:#8a8a8a;margin-bottom:24px">PRISM</div>
<div style="font-size:15px;color:#fff;margin-bottom:14px">${title}</div>
${body}
<div style="margin-top:32px;font-size:11px;color:#5a5a5a">Prism · monochrome image studio</div>
</td></tr></table></body></html>`;
}

export function button(href: string, label: string): string {
	return `<p style="margin:18px 0"><a href="${href}" style="display:inline-block;padding:10px 16px;border:1px solid #e8e8e8;color:#e8e8e8;text-decoration:none;font-size:11px;letter-spacing:0.12em;text-transform:uppercase">${label}</a></p>`;
}
