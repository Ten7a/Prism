export type Quality = '1k' | '2k' | '4k';
export type Ratio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';

export const USD_PER_TOKEN = 0.01;

export const QUALITY_TO_MP: Record<Quality, number> = {
	'1k': 1,
	'2k': 4,
	'4k': 8
};

// Rough output-token estimates per quality for per-token-priced families.
// Input tokens are constant (prompt only); output tokens scale with image size.
export const QUALITY_TO_OUTPUT_TOKENS: Record<Quality, number> = {
	'1k': 1290,
	'2k': 3870,
	'4k': 7740
};

export const PROMPT_INPUT_TOKENS = 200;

export type PricingShape =
	| { shape: 'per-image-flat'; usd: number }
	| { shape: 'per-image-tier'; tiers: Record<string, number> }
	| { shape: 'per-mp'; firstUsd: number; subsequentUsd: number }
	| { shape: 'per-token'; inUsd: number; outUsd: number };

export interface ModelEntry {
	id: string;
	displayName: string;
	capabilities: { textToImage: boolean; imageToImage: boolean; edit: boolean };
	supportedQualities: Quality[];
	supportedRatios: Ratio[];
	pricing: PricingShape;
	fetchedAt: number;
}

export interface CostEstimate {
	internalTokens: number;
	usdEstimate: number;
}

export interface CostInputs {
	quality: Quality;
	ratio: Ratio;
	batch: number;
	tier?: string;
}
