import { AwsClient } from 'aws4fetch';
import type { ObjectStore, PutBody, PutOptions } from './types';

export interface S3HttpStoreOptions {
	accountId: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	region?: string;
	publicBaseUrl?: string;
}

export class S3HttpStore implements ObjectStore {
	private readonly aws: AwsClient;
	private readonly endpoint: string;
	private readonly bucket: string;
	private readonly publicBase?: string;

	constructor(opts: S3HttpStoreOptions) {
		this.aws = new AwsClient({
			accessKeyId: opts.accessKeyId,
			secretAccessKey: opts.secretAccessKey,
			service: 's3',
			region: opts.region ?? 'auto'
		});
		this.endpoint = `https://${opts.accountId}.r2.cloudflarestorage.com`;
		this.bucket = opts.bucket;
		this.publicBase = opts.publicBaseUrl?.replace(/\/$/, '');
	}

	private url(key: string): string {
		const safe = key
			.split('/')
			.map((s) => encodeURIComponent(s))
			.join('/');
		return `${this.endpoint}/${this.bucket}/${safe}`;
	}

	async put(key: string, body: PutBody, opts: PutOptions): Promise<void> {
		const res = await this.aws.fetch(this.url(key), {
			method: 'PUT',
			body: body as BodyInit,
			headers: { 'Content-Type': opts.contentType }
		});
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			throw new Error(`S3 PUT ${key} failed: ${res.status} ${text}`);
		}
	}

	async delete(keys: string[]): Promise<void> {
		if (keys.length === 0) return;
		await Promise.all(
			keys.map(async (key) => {
				const res = await this.aws.fetch(this.url(key), { method: 'DELETE' });
				if (!res.ok && res.status !== 404) {
					const text = await res.text().catch(() => '');
					throw new Error(`S3 DELETE ${key} failed: ${res.status} ${text}`);
				}
			})
		);
	}

	async signedUrl(key: string, expiresInSec: number): Promise<string> {
		const url = new URL(this.url(key));
		url.searchParams.set('X-Amz-Expires', String(expiresInSec));
		const signed = await this.aws.sign(url.toString(), {
			method: 'GET',
			aws: { signQuery: true }
		});
		return signed.url;
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
