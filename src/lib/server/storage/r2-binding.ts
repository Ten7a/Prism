import type { ObjectStore, PutBody, PutOptions } from './types';
import { S3HttpStore, type S3HttpStoreOptions } from './s3-http';

export class R2BindingStore implements ObjectStore {
	private readonly bucket: R2Bucket;
	private readonly s3Opts: S3HttpStoreOptions;
	private readonly publicBase?: string;
	private s3?: S3HttpStore;

	constructor(bucket: R2Bucket, s3Opts: S3HttpStoreOptions) {
		this.bucket = bucket;
		this.s3Opts = s3Opts;
		this.publicBase = s3Opts.publicBaseUrl?.replace(/\/$/, '');
	}

	async put(key: string, body: PutBody, opts: PutOptions): Promise<void> {
		await this.bucket.put(key, body as ArrayBuffer | ReadableStream, {
			httpMetadata: { contentType: opts.contentType }
		});
	}

	async delete(keys: string[]): Promise<void> {
		if (keys.length === 0) return;
		await this.bucket.delete(keys);
	}

	// R2 bindings don't expose presigning — fall back to SigV4 over HTTP using the same creds.
	async signedUrl(key: string, expiresInSec: number): Promise<string> {
		this.s3 ??= new S3HttpStore(this.s3Opts);
		return this.s3.signedUrl(key, expiresInSec);
	}

	publicUrl(key: string): string {
		if (!this.publicBase) throw new Error('publicBaseUrl not configured');
		const safe = key
			.split('/')
			.map((s) => encodeURIComponent(s))
			.join('/');
		return `${this.publicBase}/${safe}`;
	}
}
