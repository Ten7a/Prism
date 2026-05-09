import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, locals }) => {
	const error = url.searchParams.get('error');
	return { error, signedIn: !!locals.user };
};
