import { marked } from 'marked';
import privacyMd from '$lib/legal/privacy.md?raw';
import { POLICY_VERSION, PRIVACY_EFFECTIVE } from '$lib/legal/versions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const html = await marked.parse(privacyMd);
	return { html, version: POLICY_VERSION, effective: PRIVACY_EFFECTIVE };
};
