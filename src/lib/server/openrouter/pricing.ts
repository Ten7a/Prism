import {
	PROMPT_INPUT_TOKENS,
	QUALITY_TO_MP,
	QUALITY_TO_OUTPUT_TOKENS,
	USD_PER_TOKEN,
	type CostEstimate,
	type CostInputs,
	type ModelEntry,
	type PricingShape,
	type Quality,
	type Ratio
} from './types';

const DEFAULT_QUALITIES: Quality[] = ['1k', '2k', '4k'];
const DEFAULT_RATIOS: Ratio[] = ['1:1', '4:3', '3:4', '16:9', '9:16'];

interface RawModel {
	id: string;
	name?: string;
	input_modalities?: string[];
	output_modalities?: string[];
	pricing?: {
		prompt?: string | number;
		completion?: string | number;
		image?: string | number;
		image_output?: string | number;
		request?: string | number;
		[k: string]: unknown;
	};
	architecture?: {
		input_modalities?: string[];
		output_modalities?: string[];
	};
}

function num(v: unknown): number | null {
	if (v === null || v === undefined) return null;
	const n = typeof v === 'string' ? Number(v) : (v as number);
	return Number.isFinite(n) ? n : null;
}

export function inferShape(raw: RawModel): PricingShape {
	const id = raw.id.toLowerCase();
	const p = raw.pricing ?? {};

	// Per-token: families known to bill on prompt+completion tokens.
	if (id.includes('gemini') || id.includes('gpt-')) {
		const inUsd = num(p.prompt) ?? 0;
		const outUsd = num(p.completion) ?? num(p.image_output) ?? 0;
		return { shape: 'per-token', inUsd, outUsd };
	}

	// Per-MP: flux family advertises a per-megapixel price.
	if (id.includes('flux')) {
		const firstUsd = num(p.image) ?? num(p.image_output) ?? 0;
		const subsequentUsd = firstUsd / 2;
		return { shape: 'per-mp', firstUsd, subsequentUsd };
	}

	// Per-image-tier: riverflow ships a fast/pro split.
	if (id.includes('riverflow')) {
		const usd = num(p.image) ?? num(p.image_output) ?? 0;
		const tierName = id.includes('pro') ? 'pro' : 'fast';
		return { shape: 'per-image-tier', tiers: { [tierName]: usd } };
	}

	// Default: per-image flat.
	const usd = num(p.image) ?? num(p.image_output) ?? num(p.request) ?? 0;
	return { shape: 'per-image-flat', usd };
}

export function normalise(raw: RawModel): ModelEntry {
	const inputs = raw.input_modalities ?? raw.architecture?.input_modalities ?? ['text'];
	const supportsImageInput = inputs.includes('image');
	return {
		id: raw.id,
		displayName: raw.name ?? raw.id,
		capabilities: {
			textToImage: true,
			imageToImage: supportsImageInput,
			edit: supportsImageInput
		},
		supportedQualities: DEFAULT_QUALITIES,
		supportedRatios: DEFAULT_RATIOS,
		pricing: inferShape(raw),
		fetchedAt: Date.now()
	};
}

function usdToTokens(usd: number): number {
	return Math.ceil(usd / USD_PER_TOKEN);
}

export function estimateCost(model: ModelEntry, inputs: CostInputs): CostEstimate {
	const { quality, batch } = inputs;
	const p = model.pricing;
	let usd = 0;

	switch (p.shape) {
		case 'per-image-flat': {
			usd = p.usd * batch;
			break;
		}
		case 'per-image-tier': {
			const tierKey = inputs.tier ?? Object.keys(p.tiers)[0];
			const tierPrice = p.tiers[tierKey] ?? 0;
			usd = tierPrice * batch;
			break;
		}
		case 'per-mp': {
			const mp = QUALITY_TO_MP[quality];
			const perImage = p.firstUsd + Math.max(0, mp - 1) * p.subsequentUsd;
			usd = perImage * batch;
			break;
		}
		case 'per-token': {
			const outTok = QUALITY_TO_OUTPUT_TOKENS[quality];
			usd = (PROMPT_INPUT_TOKENS * p.inUsd + outTok * p.outUsd) * batch;
			break;
		}
	}

	return { usdEstimate: usd, internalTokens: usdToTokens(usd) };
}
