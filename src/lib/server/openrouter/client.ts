import { env } from '$env/dynamic/private';

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

export class OpenRouterError extends Error {
	constructor(
		message: string,
		public readonly status?: number
	) {
		super(message);
		this.name = 'OpenRouterError';
	}
}

export async function orFetch(path: string, init: RequestInit = {}): Promise<Response> {
	const apiKey = env.OPENROUTER_API_KEY;
	if (!apiKey) {
		throw new OpenRouterError('OPENROUTER_API_KEY is not set');
	}
	const baseUrl = (env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
	const url = path.startsWith('http')
		? path
		: `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
	const headers = new Headers(init.headers);
	headers.set('Authorization', `Bearer ${apiKey}`);
	if (env.ORIGIN) headers.set('HTTP-Referer', env.ORIGIN);
	headers.set('X-Title', 'Prism');
	if (!headers.has('Accept')) headers.set('Accept', 'application/json');

	const res = await fetch(url, { ...init, headers });
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new OpenRouterError(
			`OpenRouter ${init.method ?? 'GET'} ${url} → ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
			res.status
		);
	}
	return res;
}
