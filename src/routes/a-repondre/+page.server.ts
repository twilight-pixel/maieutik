import { error } from '@sveltejs/kit';
import { listUnansweredRefutations } from '#lib/server/repository.js';
import { isCategory } from '#lib/shared/payloads.js';
import { pageFrom, paginate } from '#lib/pagination.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const category = url.searchParams.get('discipline') || undefined;
	if (category && !isCategory(category)) error(404);
	return {
		category: category ?? null,
		...(await paginate(pageFrom(url), 30, (limit, offset) =>
			listUnansweredRefutations({ category, limit, offset })
		))
	};
};
