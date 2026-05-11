import { env } from '$env/dynamic/private';
import { baseLog, serialiseError } from './index';

interface ParsedDsn {
	publicKey: string;
	host: string;
	projectId: string;
}

function parseDsn(dsn: string): ParsedDsn | null {
	try {
		const u = new URL(dsn);
		const projectId = u.pathname.replace(/^\//, '');
		if (!u.username || !u.host || !projectId) return null;
		return { publicKey: u.username, host: u.host, projectId };
	} catch {
		return null;
	}
}

export async function reportError(err: unknown, ctx?: Record<string, unknown>): Promise<void> {
	const dsn = env.SENTRY_DSN;
	if (!dsn) return;
	const parsed = parseDsn(dsn);
	if (!parsed) return;

	const ser = serialiseError(err);
	const eventId = (crypto as Crypto).randomUUID().replace(/-/g, '');
	const sentAt = new Date().toISOString();
	const payload = {
		event_id: eventId,
		timestamp: sentAt,
		platform: 'javascript',
		exception: {
			values: [
				{
					type: ser.name,
					value: ser.message,
					stacktrace: ser.stack ? { frames: parseStack(ser.stack) } : undefined
				}
			]
		},
		tags: ctx ? Object.fromEntries(Object.entries(ctx).map(([k, v]) => [k, String(v)])) : undefined,
		extra: ctx
	};
	const body =
		JSON.stringify({ event_id: eventId, sent_at: sentAt }) +
		'\n' +
		JSON.stringify({ type: 'event' }) +
		'\n' +
		JSON.stringify(payload);
	const url = `https://${parsed.host}/api/${parsed.projectId}/envelope/?sentry_key=${parsed.publicKey}&sentry_version=7`;
	try {
		await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-sentry-envelope' },
			body,
			signal: AbortSignal.timeout(2000)
		});
	} catch (sendErr) {
		baseLog.warn({ err: serialiseError(sendErr) }, 'sentry send failed');
	}
}

function parseStack(
	stack: string
): Array<{ function?: string; filename?: string; lineno?: number }> {
	return stack
		.split('\n')
		.slice(1)
		.map((line) => {
			const m = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):\d+\)?/);
			if (!m) return { function: line.trim() };
			return { function: m[1], filename: m[2], lineno: Number(m[3]) };
		});
}
