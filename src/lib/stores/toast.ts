import { writable } from 'svelte/store';

export type ToastEntry = {
	id: number;
	message: string;
	timeoutMs: number;
};

export type ToastOptions = {
	timeoutMs?: number;
};

const DEFAULT_TIMEOUT = 4000;

export const toasts = writable<ToastEntry[]>([]);

let nextId = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export function push(message: string, opts: ToastOptions = {}): number {
	const id = ++nextId;
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
	toasts.update((list) => [...list, { id, message, timeoutMs }]);
	if (timeoutMs > 0 && typeof window !== 'undefined') {
		const t = setTimeout(() => dismiss(id), timeoutMs);
		timers.set(id, t);
	}
	return id;
}

export function dismiss(id: number): void {
	const t = timers.get(id);
	if (t) {
		clearTimeout(t);
		timers.delete(id);
	}
	toasts.update((list) => list.filter((entry) => entry.id !== id));
}

export function clear(): void {
	for (const t of timers.values()) clearTimeout(t);
	timers.clear();
	toasts.set([]);
}
