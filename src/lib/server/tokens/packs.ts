export type Pack = {
	slug: string;
	name: string;
	tokens: number;
	priceCents: number;
	note: string;
};

export const PACKS: readonly Pack[] = [
	{
		slug: 'starter',
		name: '100 tokens',
		tokens: 100,
		priceCents: 500,
		note: '≈ 25 standard images'
	},
	{ slug: 'pro', name: '250 tokens', tokens: 250, priceCents: 1000, note: 'best $/token' },
	{ slug: 'studio', name: '600 tokens', tokens: 600, priceCents: 2000, note: '' },
	{
		slug: 'bulk',
		name: '2000 tokens',
		tokens: 2000,
		priceCents: 5000,
		note: 'best for power users'
	}
] as const;

export function formatUsd(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`;
}
