import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { grantDailyAllowanceIfDue } from '$lib/server/tokens/grant';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
		const userId = session.user.id;
		const grant = grantDailyAllowanceIfDue(userId).catch((err) => {
			console.error('[grant] failed', err);
		});
		const ctx = (event.platform as { context?: { waitUntil?: (p: Promise<unknown>) => void } } | undefined)
			?.context;
		if (ctx?.waitUntil) ctx.waitUntil(grant);
		else void grant;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
