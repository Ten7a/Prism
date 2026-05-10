type Level = 'debug' | 'info' | 'warn' | 'error';
const LEVELS: Record<Level | 'silent', number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
	silent: 100
};

export interface Logger {
	debug(obj: object, msg?: string): void;
	info(obj: object, msg?: string): void;
	warn(obj: object, msg?: string): void;
	error(obj: object, msg?: string): void;
	child(bindings: object): Logger;
}

function currentThreshold(): number {
	const raw = (typeof process !== 'undefined' ? process.env?.LOG_LEVEL : undefined) ?? 'info';
	const key = raw.toLowerCase() as Level | 'silent';
	return LEVELS[key] ?? LEVELS.info;
}

function emit(level: Level, bindings: object, fields: object, msg?: string): void {
	if (LEVELS[level] < currentThreshold()) return;
	const line = JSON.stringify({
		ts: new Date().toISOString(),
		level,
		msg: msg ?? '',
		...bindings,
		...fields
	});
	console.log(line);
}

function make(bindings: object): Logger {
	const frozen = Object.freeze({ ...bindings });
	return {
		debug: (o, m) => emit('debug', frozen, o, m),
		info: (o, m) => emit('info', frozen, o, m),
		warn: (o, m) => emit('warn', frozen, o, m),
		error: (o, m) => emit('error', frozen, o, m),
		child: (extra) => make({ ...frozen, ...extra })
	};
}

export const baseLog: Logger = make({});

export function serialiseError(e: unknown): { name: string; message: string; stack?: string } {
	if (e instanceof Error) {
		const stack = e.stack
			? e.stack.split('\n').slice(0, 20).join('\n')
			: undefined;
		return { name: e.name, message: e.message, stack };
	}
	return { name: 'NonError', message: String(e) };
}
