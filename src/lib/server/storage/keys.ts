const MIME_EXT: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp'
};

export type AllowedUploadMime = keyof typeof MIME_EXT;

function extFor(mime: string): string {
	const ext = MIME_EXT[mime];
	if (!ext) throw new Error(`unsupported mime: ${mime}`);
	return ext;
}

export function uploadKey(userId: string, mime: string): string {
	const ext = extFor(mime);
	return `uploads/${userId}/${crypto.randomUUID()}.${ext}`;
}

export function imageKey(userId: string, jobId: string, idx: number, ext = 'png'): string {
	return `images/${userId}/${jobId}/${idx}.${ext}`;
}

export function extForMime(mime: string): string {
	return MIME_EXT[mime] ?? 'png';
}
