import { marked } from 'marked';
import termsMd from '$lib/legal/terms.md?raw';
import { POLICY_VERSION, TERMS_EFFECTIVE } from '$lib/legal/versions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const html = await marked.parse(termsMd);
	return { html, version: POLICY_VERSION, effective: TERMS_EFFECTIVE };
};
