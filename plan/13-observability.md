# 13 — Observability

## Goal

When something breaks in production, the operator needs to find it fast. Add structured logging, request IDs threaded everywhere, an error reporter, a `/healthz` probe, and minimal metrics counters.

## Touches

- `src/lib/server/log/index.ts` — structured JSON logger.
- `src/lib/server/log/error-reporter.ts` — Sentry-compatible HTTP sink (works without the SDK; `POST` to `SENTRY_DSN` if set).
- `src/lib/server/log/metrics.ts` — counters (in-memory; scrape via `/api/metrics` for self-hosters).
- `src/hooks.server.ts` — request-id middleware, error hook.
- `src/routes/api/healthz/+server.ts` — DB + R2 reachability check.
- `src/routes/api/metrics/+server.ts` — Prometheus text-format dump (gated by `METRICS_TOKEN`).
- `.env.example` — `SENTRY_DSN`, `LOG_LEVEL=info`, `METRICS_TOKEN`.

## Reuses

- `db` from [`db/index.ts`](../src/lib/server/db/index.ts).
- `storage()` from step 04.
- `crypto.randomUUID` (Workers + Node both support it).

## Logger contract

```ts
export interface Logger {
	debug(obj: object, msg?: string): void;
	info(obj: object, msg?: string): void;
	warn(obj: object, msg?: string): void;
	error(obj: object, msg?: string): void;
	child(bindings: object): Logger;
}
```

- Output is single-line JSON: `{ts, level, msg, ...bindings}`.
- `child()` returns a logger with extra default bindings (e.g. `requestId`, `userId`, `jobId`).
- Honour `LOG_LEVEL`.

## Steps

1. Implement `log/index.ts` — a tiny logger (~50 lines), no dep. `pino`-style ergonomics but Workers-safe.
2. `error-reporter.ts`:
   - If `SENTRY_DSN` set, build the Sentry Envelope JSON manually and `fetch` to the DSN ingest endpoint. No SDK = no extra runtime weight on Workers.
   - Otherwise no-op (logs the error locally).
3. `hooks.server.ts`:

   ```ts
   export const handle: Handle = async ({ event, resolve }) => {
   	const requestId = event.request.headers.get('x-request-id') ?? crypto.randomUUID();
   	const start = Date.now();
   	event.locals.log = baseLog.child({
   		requestId,
   		path: event.url.pathname,
   		method: event.request.method
   	});
   	event.setHeaders({ 'x-request-id': requestId });
   	try {
   		const res = await resolve(event);
   		event.locals.log.info({ status: res.status, ms: Date.now() - start }, 'req');
   		return res;
   	} catch (e) {
   		event.locals.log.error({ err: serialiseError(e) }, 'unhandled');
   		reportError(e, { requestId });
   		throw e;
   	}
   };

   export const handleError: HandleServerError = ({ error, event }) => {
   	event.locals?.log?.error({ err: serialiseError(error) }, 'server-error');
   	reportError(error, { requestId: event.locals?.requestId });
   	return { message: 'Internal error', requestId: event.locals?.requestId };
   };
   ```

4. Plumb `event.locals.log` into every server route that creates a `child` (jobId, userId).
5. `/api/healthz`:
   - Runs `SELECT 1` on the DB and a `HEAD` on a known R2 key.
   - Returns `200 { db: 'ok', r2: 'ok', commit: env.GIT_SHA }` or `503` with details.
6. `metrics.ts` — small `Counter`/`Histogram` API, in-memory map. Counters: `prism_generation_total{status}`, `prism_token_debit_total`, `prism_token_refund_total`, `prism_http_requests_total{route,status}`.
7. `/api/metrics` text endpoint, gated by `Authorization: Bearer ${METRICS_TOKEN}`.

## Tests

`src/lib/server/log/index.spec.ts`:

```ts
test('emits JSON line with bindings + msg', () => {
	const out = capture(() => baseLog.info({ a: 1 }, 'hello'));
	const parsed = JSON.parse(out);
	expect(parsed).toMatchObject({ level: 'info', msg: 'hello', a: 1 });
});

test('child merges bindings; never mutates parent', () => {
	const c = baseLog.child({ userId: 'u1' });
	const out = capture(() => c.info({}, 'x'));
	expect(JSON.parse(out)).toMatchObject({ userId: 'u1' });
	expect(capture(() => baseLog.info({}, 'x'))).not.toContain('u1');
});

test('respects LOG_LEVEL=warn — info is dropped', () => {
	process.env.LOG_LEVEL = 'warn';
	expect(capture(() => baseLog.info({}, 'x'))).toBe('');
	expect(capture(() => baseLog.warn({}, 'x'))).not.toBe('');
});
```

`src/hooks.server.spec.ts`:

```ts
test('attaches x-request-id header to response', async () => {
	const res = await app.fetch('/');
	expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
});

test('failing route logs error with the same requestId', async () => {
	const log = installLogSpy();
	const res = await app.fetch('/api/__throw');
	const reqId = res.headers.get('x-request-id');
	expect(log.records.find((r) => r.level === 'error' && r.requestId === reqId)).toBeTruthy();
});
```

`e2e/healthz.test.ts`:

```ts
test('healthz returns ok in dev', async ({ request }) => {
	const r = await request.get('/api/healthz');
	expect(r.status()).toBe(200);
	expect((await r.json()).db).toBe('ok');
});

test('metrics requires bearer token', async ({ request }) => {
	expect((await request.get('/api/metrics')).status()).toBe(401);
	const ok = await request.get('/api/metrics', { headers: { authorization: 'Bearer test-token' } });
	expect(ok.status()).toBe(200);
	expect(await ok.text()).toContain('prism_http_requests_total');
});
```

Edge case: a Postgres outage should surface in `/healthz` as `db: 'fail'` with the error string (sanitized — no creds), not crash the route handler.

## Verify

```bash
npm run check
npm run test:unit -- --run src/lib/server/log
npm run test:e2e -- e2e/healthz.test.ts
curl -s localhost:5173/api/healthz | jq
curl -s -H "Authorization: Bearer $METRICS_TOKEN" localhost:5173/api/metrics
```

Acceptance: every response carries an `x-request-id`, every error log line shares that id, `/healthz` is honest about the DB and R2, `/metrics` exposes counters in Prometheus format, and configuring `SENTRY_DSN` causes errors to land in Sentry without adding a dependency.
