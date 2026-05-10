export type PutBody = ArrayBuffer | Uint8Array | ReadableStream;

export interface PutOptions {
	contentType: string;
}

export interface ObjectStore {
	put(key: string, body: PutBody, opts: PutOptions): Promise<void>;
	delete(keys: string[]): Promise<void>;
	head(key: string): Promise<{ exists: boolean }>;
	signedUrl(key: string, expiresInSec: number): Promise<string>;
	publicUrl?(key: string): string;
}
