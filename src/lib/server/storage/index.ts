import { env } from '$env/dynamic/private';
import type { ObjectStore } from './types';
import { S3HttpStore, type S3HttpStoreOptions } from './s3-http';
import { R2BindingStore } from './r2-binding';

export type { ObjectStore } from './types';
export { uploadKey, imageKey } from './keys';

function s3OptsFromEnv(): S3HttpStoreOptions {
	const accountId = env.R2_ACCOUNT_ID;
	const accessKeyId = env.R2_ACCESS_KEY_ID;
	const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
	const bucket = env.R2_BUCKET;
	if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
		throw new Error(
			'Storage env not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET'
		);
	}
	return {
		accountId,
		accessKeyId,
		secretAccessKey,
		bucket,
		publicBaseUrl: env.R2_PUBLIC_BASE_URL || undefined
	};
}

export function storage(platform?: App.Platform): ObjectStore {
	const driver = env.STORAGE_DRIVER ?? 's3';
	if (driver === 'r2' && platform?.env?.R2) {
		return new R2BindingStore(platform.env.R2, s3OptsFromEnv());
	}
	return new S3HttpStore(s3OptsFromEnv());
}

export async function bulkDelete(keys: string[], platform?: App.Platform): Promise<void> {
	if (keys.length === 0) return;
	await storage(platform).delete(keys);
}
