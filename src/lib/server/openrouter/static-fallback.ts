import type { ModelEntry } from './types';

// Hand-curated snapshot covering one model in each pricing shape.
// Used when the live OpenRouter call fails (offline, key unset, transient error).
// Update by snapshotting `GET /models?output_modalities=image` and re-running normalise().
export const fallbackModels: ModelEntry[] = [
	{
		id: 'google/gemini-2.5-flash-image',
		displayName: 'Gemini 2.5 Flash Image',
		capabilities: { textToImage: true, imageToImage: true, edit: true },
		supportedQualities: ['1k', '2k', '4k'],
		supportedRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
		pricing: { shape: 'per-token', inUsd: 0.0000003, outUsd: 0.0000025 },
		fetchedAt: 0
	},
	{
		id: 'openai/gpt-image-1',
		displayName: 'GPT Image 1',
		capabilities: { textToImage: true, imageToImage: true, edit: true },
		supportedQualities: ['1k', '2k', '4k'],
		supportedRatios: ['1:1', '16:9', '9:16'],
		pricing: { shape: 'per-token', inUsd: 0.000005, outUsd: 0.00004 },
		fetchedAt: 0
	},
	{
		id: 'black-forest-labs/flux.2-pro',
		displayName: 'FLUX.2 Pro',
		capabilities: { textToImage: true, imageToImage: false, edit: false },
		supportedQualities: ['1k', '2k', '4k'],
		supportedRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
		pricing: { shape: 'per-mp', firstUsd: 0.03, subsequentUsd: 0.015 },
		fetchedAt: 0
	},
	{
		id: 'black-forest-labs/flux.2-klein-4b',
		displayName: 'FLUX.2 Klein 4B',
		capabilities: { textToImage: true, imageToImage: false, edit: false },
		supportedQualities: ['1k', '2k', '4k'],
		supportedRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
		pricing: { shape: 'per-mp', firstUsd: 0.005, subsequentUsd: 0.0025 },
		fetchedAt: 0
	},
	{
		id: 'bytedance-seed/seedream-4.5',
		displayName: 'Seedream 4.5',
		capabilities: { textToImage: true, imageToImage: true, edit: true },
		supportedQualities: ['1k', '2k', '4k'],
		supportedRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
		pricing: { shape: 'per-image-flat', usd: 0.04 },
		fetchedAt: 0
	},
	{
		id: 'sourceful/riverflow-v2-fast',
		displayName: 'Riverflow v2 Fast',
		capabilities: { textToImage: true, imageToImage: false, edit: false },
		supportedQualities: ['1k', '2k'],
		supportedRatios: ['1:1', '4:3', '16:9'],
		pricing: { shape: 'per-image-tier', tiers: { fast: 0.01 } },
		fetchedAt: 0
	},
	{
		id: 'sourceful/riverflow-v2-pro',
		displayName: 'Riverflow v2 Pro',
		capabilities: { textToImage: true, imageToImage: false, edit: false },
		supportedQualities: ['1k', '2k', '4k'],
		supportedRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
		pricing: { shape: 'per-image-tier', tiers: { pro: 0.04 } },
		fetchedAt: 0
	}
];
