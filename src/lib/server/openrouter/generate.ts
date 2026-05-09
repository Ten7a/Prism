import { orFetch, OpenRouterError } from './client';
import { QUALITY_TO_MP, type ModelEntry, type Quality, type Ratio } from './types';

export interface GenerateInput {
	prompt: string;
	quality: Quality;
	ratio: Ratio;
	refImageUrls?: string[];
}

export interface GeneratedImage {
	bytes: Uint8Array;
	mime: string;
	width: number;
	height: number;
}

const RATIO_TO_WH: Record<Ratio, [number, number]> = {
	'1:1': [1, 1],
	'4:3': [4, 3],
	'3:4': [3, 4],
	'16:9': [16, 9],
	'9:16': [9, 16]
};

export function qualityToSize(quality: Quality, ratio: Ratio): { width: number; height: number } {
	const mp = QUALITY_TO_MP[quality];
	const [aw, ah] = RATIO_TO_WH[ratio];
	const target = mp * 1_000_000;
	const heightF = Math.sqrt((target * ah) / aw);
	const widthF = (heightF * aw) / ah;
	const round = (n: number) => Math.max(64, Math.round(n / 64) * 64);
	return { width: round(widthF), height: round(heightF) };
}

function pickShape(model: ModelEntry): 'chat' | 'images' {
	return model.pricing.shape === 'per-token' ? 'chat' : 'images';
}

interface BuiltRequest {
	url: string;
	init: RequestInit;
}

export function buildRequest(model: ModelEntry, input: GenerateInput): BuiltRequest {
	const shape = pickShape(model);
	const { width, height } = qualityToSize(input.quality, input.ratio);

	if (shape === 'chat') {
		const content: Array<Record<string, unknown>> = [{ type: 'text', text: input.prompt }];
		for (const url of input.refImageUrls ?? []) {
			content.push({ type: 'image_url', image_url: { url } });
		}
		const body = {
			model: model.id,
			modalities: ['image', 'text'],
			messages: [{ role: 'user', content }]
		};
		return {
			url: '/chat/completions',
			init: {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			}
		};
	}

	const body: Record<string, unknown> = {
		model: model.id,
		prompt: input.prompt,
		size: `${width}x${height}`,
		n: 1,
		response_format: 'b64_json'
	};
	if (input.refImageUrls && input.refImageUrls.length > 0) {
		body.image = input.refImageUrls.length === 1 ? input.refImageUrls[0] : input.refImageUrls;
	}
	return {
		url: '/images/generations',
		init: {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}
	};
}

function decodeBase64(b64: string): Uint8Array {
	const clean = b64.includes(',') ? b64.split(',', 2)[1] : b64;
	if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(clean, 'base64'));
	const binary = atob(clean);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
	return out;
}

function mimeFromDataUrl(s: string): string | null {
	const m = /^data:([^;]+);base64,/.exec(s);
	return m ? m[1] : null;
}

async function fetchBytes(url: string): Promise<{ bytes: Uint8Array; mime: string }> {
	const res = await fetch(url);
	if (!res.ok) throw new OpenRouterError(`fetch image ${res.status}`);
	const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
	const buf = new Uint8Array(await res.arrayBuffer());
	return { bytes: buf, mime };
}

export async function parseImages(
	res: Response,
	model: ModelEntry,
	expected: { width: number; height: number }
): Promise<GeneratedImage[]> {
	const shape = pickShape(model);
	const data = (await res.json()) as Record<string, unknown>;

	if (shape === 'chat') {
		const choices = (data.choices as Array<Record<string, unknown>> | undefined) ?? [];
		const out: GeneratedImage[] = [];
		for (const choice of choices) {
			const message = choice.message as Record<string, unknown> | undefined;
			const images = (message?.images as Array<Record<string, unknown>> | undefined) ?? [];
			for (const img of images) {
				const inner = (img.image_url as Record<string, unknown> | undefined) ?? img;
				const url = inner.url as string | undefined;
				if (!url) continue;
				if (url.startsWith('data:')) {
					const mime = mimeFromDataUrl(url) ?? 'image/png';
					out.push({
						bytes: decodeBase64(url),
						mime,
						width: expected.width,
						height: expected.height
					});
				} else {
					const fetched = await fetchBytes(url);
					out.push({
						bytes: fetched.bytes,
						mime: fetched.mime,
						width: expected.width,
						height: expected.height
					});
				}
			}
		}
		if (out.length === 0) throw new OpenRouterError('no images in chat completion response');
		return out;
	}

	const items = (data.data as Array<Record<string, unknown>> | undefined) ?? [];
	const out: GeneratedImage[] = [];
	for (const item of items) {
		const b64 = item.b64_json as string | undefined;
		const url = item.url as string | undefined;
		if (b64) {
			out.push({
				bytes: decodeBase64(b64),
				mime: 'image/png',
				width: expected.width,
				height: expected.height
			});
		} else if (url) {
			const fetched = await fetchBytes(url);
			out.push({
				bytes: fetched.bytes,
				mime: fetched.mime,
				width: expected.width,
				height: expected.height
			});
		}
	}
	if (out.length === 0) throw new OpenRouterError('no images in images response');
	return out;
}

export async function generateOne(
	model: ModelEntry,
	input: GenerateInput
): Promise<GeneratedImage[]> {
	const { url, init } = buildRequest(model, input);
	const res = await orFetch(url, init);
	const expected = qualityToSize(input.quality, input.ratio);
	return parseImages(res, model, expected);
}
