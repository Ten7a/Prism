// Word-boundary blocklist. Use regex (not String.includes) so that benign words
// containing the same letters do not falsely match.
const BLOCKED_TERMS = [
	'csam',
	'childporn',
	'lolicon',
	'shotacon',
	'bestiality'
];

const BLOCKED_REGEXES = BLOCKED_TERMS.map((t) => new RegExp(`\\b${escape(t)}\\b`, 'i'));

function escape(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface BlocklistResult {
	blocked: boolean;
	matched?: string;
}

export function isBlocked(prompt: string): BlocklistResult {
	for (let i = 0; i < BLOCKED_REGEXES.length; i++) {
		if (BLOCKED_REGEXES[i].test(prompt)) {
			return { blocked: true, matched: BLOCKED_TERMS[i] };
		}
	}
	return { blocked: false };
}

export const _BLOCKED_TERMS_FOR_TESTS = BLOCKED_TERMS;
