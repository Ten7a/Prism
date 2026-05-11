import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadModels } from '$lib/server/openrouter/registry';

export const GET: RequestHandler = async ({ platform }) => {
	const models = await loadModels(platform);
	return json(
		{ models },
		{
			headers: {
				'Cache-Control': 'public, max-age=300'
			}
		}
	);
};
