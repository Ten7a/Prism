import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { registry } from '$lib/server/log/metrics';

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return mismatch === 0;
}

export const GET: RequestHandler = async ({ request }) => {
	const token = env.METRICS_TOKEN;
	if (!token) error(404, 'not found');
	const auth = request.headers.get('authorization') ?? '';
	const match = /^Bearer\s+(.+)$/i.exec(auth);
	if (!match || !timingSafeEqual(match[1], token)) error(401, 'unauthorized');

	return new Response(registry.renderProm(), {
		status: 200,
		headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' }
	});
};
