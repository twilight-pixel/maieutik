import { error } from '@sveltejs/kit';
import { getPseudonym, listPseudonymTexts } from '#lib/server/repository.js';
import { decodeKey } from '#lib/shared/signature.js';
import { pageFrom, paginate } from '#lib/pagination.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	let publicKey: Uint8Array;
	try {
		publicKey = decodeKey(params.key);
	} catch {
		error(404);
	}
	const pseudonym = await getPseudonym(publicKey);
	if (!pseudonym) error(404);
	return {
		pseudonym,
		...(await paginate(pageFrom(url), 50, (limit, offset) =>
			listPseudonymTexts(publicKey, { limit, offset })
		))
	};
};
