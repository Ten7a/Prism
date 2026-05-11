import { error } from '@sveltejs/kit';
import { and, asc, eq, gt } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index';
import { generationJob, image as imageTbl } from '$lib/server/db/schema';
import { subscribe, type JobEvent } from '$lib/server/generations/notify';
import { storage } from '$lib/server/storage';
import { baseLog } from '$lib/server/log';

const sseLog = baseLog.child({ mod: 'sse' });

const POLL_INTERVAL_MS = 750;
const HEARTBEAT_MS = 25_000;

function isWorkers(platform?: App.Platform): boolean {
	return !!platform?.env;
}

export const GET: RequestHandler = async ({ params, locals, request, platform }) => {
	if (!locals.user) throw error(401, 'unauthorized');

	const [job] = await db
		.select()
		.from(generationJob)
		.where(and(eq(generationJob.id, params.id), eq(generationJob.userId, locals.user.id)))
		.limit(1);
	if (!job) throw error(404, 'not found');

	const userId = locals.user.id;
	const jobId = job.id;
	const store = storage(platform);

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const enc = new TextEncoder();
			let closed = false;
			const cleanups: Array<() => void> = [];

			const send = (evt: JobEvent | { type: 'heartbeat' }) => {
				if (closed) return;
				try {
					controller.enqueue(enc.encode(`data: ${JSON.stringify(evt)}\n\n`));
				} catch {
					closed = true;
				}
			};

			const close = () => {
				if (closed) return;
				closed = true;
				for (const fn of cleanups) {
					try {
						fn();
					} catch {
						/* ignore */
					}
				}
				try {
					controller.close();
				} catch {
					/* already closed */
				}
			};

			// Heartbeat to keep proxies from idling out the connection.
			const hb = setInterval(() => send({ type: 'heartbeat' }), HEARTBEAT_MS);
			cleanups.push(() => clearInterval(hb));

			request.signal.addEventListener('abort', close);

			// Replay current state.
			const replayImages = await db
				.select()
				.from(imageTbl)
				.where(eq(imageTbl.jobId, jobId))
				.orderBy(asc(imageTbl.createdAt));
			for (let i = 0; i < replayImages.length; i++) {
				const im = replayImages[i];
				let url: string | undefined;
				try {
					url = await store.signedUrl(im.r2Key, 600);
				} catch {
					/* fall back to api endpoint */
				}
				send({
					type: 'image',
					i,
					imageId: im.id,
					key: im.r2Key,
					url,
					width: im.width,
					height: im.height,
					mime: im.mime,
					bytes: im.bytes
				});
			}
			if (job.status === 'succeeded') {
				send({ type: 'done', costActual: job.costActual ?? job.costEstimate });
				close();
				return;
			}
			if (job.status === 'failed') {
				send({ type: 'error', code: job.errorCode ?? 'unknown' });
				close();
				return;
			}

			// Local in-mem subscriber (fast path; sole mechanism on Workers).
			const unsub = subscribe(jobId, (evt) => {
				send(evt);
				if (evt.type === 'done' || evt.type === 'error') close();
			});
			cleanups.push(unsub);

			if (isWorkers(platform)) {
				// Short-poll fallback for Workers (no LISTEN/NOTIFY over Hyperdrive).
				let lastImageAt: Date = replayImages.at(-1)?.createdAt ?? new Date(0);
				let lastImageCount = replayImages.length;
				const poll = setInterval(async () => {
					if (closed) return;
					try {
						const fresh = await db
							.select()
							.from(imageTbl)
							.where(and(eq(imageTbl.jobId, jobId), gt(imageTbl.createdAt, lastImageAt)))
							.orderBy(asc(imageTbl.createdAt));
						for (const im of fresh) {
							let url: string | undefined;
							try {
								url = await store.signedUrl(im.r2Key, 600);
							} catch {
								/* ignore */
							}
							send({
								type: 'image',
								i: lastImageCount++,
								imageId: im.id,
								key: im.r2Key,
								url,
								width: im.width,
								height: im.height,
								mime: im.mime,
								bytes: im.bytes
							});
							lastImageAt = im.createdAt;
						}

						const [latest] = await db
							.select({
								status: generationJob.status,
								costActual: generationJob.costActual,
								errorCode: generationJob.errorCode
							})
							.from(generationJob)
							.where(eq(generationJob.id, jobId))
							.limit(1);
						if (!latest) return;
						if (latest.status === 'succeeded') {
							send({
								type: 'done',
								costActual: latest.costActual ?? job.costEstimate
							});
							close();
						} else if (latest.status === 'failed') {
							send({ type: 'error', code: latest.errorCode ?? 'unknown' });
							close();
						}
					} catch (err) {
						sseLog.warn({ err: (err as Error).message }, 'poll failed');
					}
				}, POLL_INTERVAL_MS);
				cleanups.push(() => clearInterval(poll));
			} else {
				// Node: subscribe to pg_notify for cross-process delivery.
				try {
					const { pgSubscribe } = await import('$lib/server/generations/listen');
					const off = await pgSubscribe(`job:${jobId}`, (payload) => {
						try {
							const evt = JSON.parse(payload) as JobEvent;
							send(evt);
							if (evt.type === 'done' || evt.type === 'error') close();
						} catch {
							/* malformed payload; ignore */
						}
					});
					cleanups.push(() => {
						off();
					});
				} catch (err) {
					sseLog.warn({ err: (err as Error).message }, 'pgSubscribe unavailable');
				}
			}

			// Avoid unused-locals warning for userId; ownership already validated above.
			void userId;
		},
		cancel() {
			/* close handled via abort signal */
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
