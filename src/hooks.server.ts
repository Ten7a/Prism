import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { grantDailyAllowanceIfDue } from '$lib/server/tokens/grant';
import { getLimiter, parseRateSpec } from '$lib/server/ratelimit';
import { baseLog, serialiseError } from '$lib/server/log';
import { reportError } from '$lib/server/log/error-reporter';
import { incCounter } from '$lib/server/log/metrics';

const handleRequestContext: Handle = async ({ event, resolve }) => {
	const requestId = event.request.headers.get('x-request-id') ?? crypto.randomUUID();
	event.locals.requestId = requestId;
	event.locals.log = baseLog.child({
		requestId,
		path: event.url.pathname,
		method: event.request.method
	});
	event.setHeaders({ 'x-request-id': requestId });
	const start = Date.now();
	try {
		const res = await resolve(event);
		const route = event.route?.id ?? 'unknown';
		event.locals.log.info({ status: res.status, ms: Date.now() - start, route }, 'req');
		incCounter('prism_http_requests_total', { route, status: res.status });
		return res;
	} catch (err) {
		event.locals.log.error({ err: serialiseError(err) }, 'unhandled');
		await reportError(err, { requestId });
		throw err;
	}
};

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
		const userId = session.user.id;
		const log = event.locals.log;
		const grant = grantDailyAllowanceIfDue(userId).catch((err) => {
			log.error({ err: serialiseError(err) }, 'grant failed');
		});
		const ctx = (
			event.platform as { context?: { waitUntil?: (p: Promise<unknown>) => void } } | undefined
		)?.context;
		if (ctx?.waitUntil) ctx.waitUntil(grant);
		else void grant;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

const handleApiRateLimit: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);
	if (!event.url.pathname.startsWith('/api/')) return resolve(event);

	const limiter = getLimiter(event.platform);
	const isUser = !!event.locals.user;
	const spec = parseRateSpec(
		isUser ? env.RATE_LIMIT_USER : env.RATE_LIMIT_ANON,
		isUser ? { capacity: 600, refillPerSec: 600 / 3600 } : { capacity: 60, refillPerSec: 1 }
	);
	const key = isUser
		? `api:user:${event.locals.user!.id}`
		: `api:ip:${getClientAddressSafe(event)}`;
	const result = await limiter.hit(key, spec);
	if (!result.allowed) {
		event.locals.log?.warn({ key, retryAfter: result.retryAfterSec }, 'rate limited');
		return new Response('rate_limited', {
			status: 429,
			headers: {
				'Retry-After': String(result.retryAfterSec ?? 1),
				'Content-Type': 'text/plain'
			}
		});
	}
	return resolve(event);
};

function getClientAddressSafe(event: Parameters<Handle>[0]['event']): string {
	try {
		return event.getClientAddress();
	} catch {
		return event.request.headers.get('cf-connecting-ip') || 'unknown';
	}
}

export const handle: Handle = sequence(handleRequestContext, handleBetterAuth, handleApiRateLimit);

export const handleError: HandleServerError = ({ error, event }) => {
	const log = event.locals?.log ?? baseLog;
	log.error({ err: serialiseError(error) }, 'server-error');
	void reportError(error, { requestId: event.locals?.requestId });
	return { message: 'Internal error', requestId: event.locals?.requestId };
};
