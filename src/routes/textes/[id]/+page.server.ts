import { error } from '@sveltejs/kit';
import { getText } from '#lib/server/repository.js';
import { isUuid } from '#lib/shared/payloads.js';
import { pageFrom } from '#lib/pagination.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	if (!isUuid(params.id)) error(404);
	const text = await getText(params.id, undefined, { repliesPage: pageFrom(url, 'reponses') });
	if (!text) error(404);
	return { text, latest: true };
};
