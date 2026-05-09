// In-memory per-user upload rate limiter. Real (durable) limiter lands in step 12.
const HOUR_MS = 60 * 60 * 1000;
const buckets = new Map<string, number[]>();

export function checkUploadRate(userId: string, limit = 30): boolean {
	const now = Date.now();
	const cutoff = now - HOUR_MS;
	const arr = (buckets.get(userId) ?? []).filter((t) => t > cutoff);
	if (arr.length >= limit) {
		buckets.set(userId, arr);
		return false;
	}
	arr.push(now);
	buckets.set(userId, arr);
	return true;
}

export function _resetRateLimits() {
	buckets.clear();
}
