import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { grantDailyAllowanceIfDue } from '$lib/server/tokens/grant';
import { getLimiter, parseRateSpec } from '$lib/server/ratelimit';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
		const userId = session.user.id;
		const grant = grantDailyAllowanceIfDue(userId).catch((err) => {
			console.error('[grant] failed', err);
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

export const handle: Handle = sequence(handleBetterAuth, handleApiRateLimit);
