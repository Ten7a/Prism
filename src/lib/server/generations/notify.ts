export type JobEvent =
	| { type: 'progress'; i: number; total: number }
	| {
			type: 'image';
			i: number;
			imageId: string;
			key: string;
			url?: string;
			width: number;
			height: number;
			mime: string;
			bytes: number;
	  }
	| { type: 'shard_error'; i: number; code: string }
	| { type: 'done'; costActual: number }
	| { type: 'error'; code: string };

type Subscriber = (evt: JobEvent) => void;

const subscribers = new Map<string, Set<Subscriber>>();

export function subscribe(jobId: string, cb: Subscriber): () => void {
	let set = subscribers.get(jobId);
	if (!set) {
		set = new Set();
		subscribers.set(jobId, set);
	}
	set.add(cb);
	return () => {
		const s = subscribers.get(jobId);
		if (!s) return;
		s.delete(cb);
		if (s.size === 0) subscribers.delete(jobId);
	};
}

function deliverLocal(jobId: string, evt: JobEvent): void {
	const set = subscribers.get(jobId);
	if (!set) return;
	for (const cb of [...set]) {
		try {
			cb(evt);
		} catch (err) {
			console.warn('[notify] subscriber threw:', (err as Error).message);
		}
	}
}

export async function publish(jobId: string, evt: JobEvent): Promise<void> {
	deliverLocal(jobId, evt);

	if (typeof process !== 'undefined' && process?.versions?.node) {
		try {
			const { pgNotify } = await import('./listen');
			await pgNotify(`job:${jobId}`, JSON.stringify(evt));
		} catch (err) {
			// LISTEN/NOTIFY is best-effort; in-mem delivery already succeeded.
			console.warn('[notify] pg_notify failed:', (err as Error).message);
		}
	}
}

export function _resetSubscribersForTests(): void {
	subscribers.clear();
}
