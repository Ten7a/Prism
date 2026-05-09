import postgres from 'postgres';
import { env } from '$env/dynamic/private';

type Listener = (payload: string) => void;

let client: ReturnType<typeof postgres> | null = null;
const channelSubs = new Map<string, Set<Listener>>();
const channelHandles = new Map<string, Promise<{ unlisten: () => Promise<void> }>>();

function getClient(): ReturnType<typeof postgres> {
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
	if (!client) client = postgres(env.DATABASE_URL, { max: 1 });
	return client;
}

export async function pgSubscribe(channel: string, cb: Listener): Promise<() => void> {
	let set = channelSubs.get(channel);
	if (!set) {
		set = new Set();
		channelSubs.set(channel, set);
	}
	set.add(cb);

	if (!channelHandles.has(channel)) {
		const c = getClient();
		const handle = c.listen(channel, (payload: string) => {
			const subs = channelSubs.get(channel);
			if (!subs) return;
			for (const s of [...subs]) {
				try {
					s(payload);
				} catch (err) {
					console.warn('[listen] subscriber threw:', (err as Error).message);
				}
			}
		});
		channelHandles.set(channel, handle);
	}

	return () => {
		const subs = channelSubs.get(channel);
		if (!subs) return;
		subs.delete(cb);
		if (subs.size === 0) {
			channelSubs.delete(channel);
			const handle = channelHandles.get(channel);
			channelHandles.delete(channel);
			if (handle) {
				handle
					.then((h) => h.unlisten())
					.catch((err) =>
						console.warn('[listen] unlisten failed:', (err as Error).message)
					);
			}
		}
	};
}

export async function pgNotify(channel: string, payload: string): Promise<void> {
	const c = getClient();
	await c`SELECT pg_notify(${channel}, ${payload})`;
}
