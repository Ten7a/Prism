// R2 storage helper. Real implementation lands with step 04 (generate).
// For now, expose a no-op so call sites are real.

export async function bulkDelete(keys: string[]): Promise<void> {
	if (keys.length === 0) return;
	console.warn(`[r2] bulkDelete stub — ${keys.length} object(s) not removed:`, keys.slice(0, 5));
}
