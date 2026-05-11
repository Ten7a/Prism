export interface RateSpec {
	capacity: number;
	refillPerSec: number;
}

const UNIT_SECONDS: Record<string, number> = {
	s: 1,
	m: 60,
	h: 3600,
	d: 86400
};

export function parseRateSpec(spec: string | undefined, fallback?: RateSpec): RateSpec {
	if (!spec || !spec.trim()) {
		if (fallback) return fallback;
		throw new Error('rate spec is empty');
	}
	const m = /^\s*(\d+)\s*\/\s*([smhd])\s*$/i.exec(spec);
	if (!m) {
		if (fallback) return fallback;
		throw new Error(`invalid rate spec: ${spec}`);
	}
	const capacity = Number(m[1]);
	const seconds = UNIT_SECONDS[m[2].toLowerCase()];
	if (!Number.isFinite(capacity) || capacity <= 0 || !seconds) {
		if (fallback) return fallback;
		throw new Error(`invalid rate spec: ${spec}`);
	}
	return { capacity, refillPerSec: capacity / seconds };
}
