import { error } from '@sveltejs/kit';
import { listQuestions } from '#lib/server/repository.js';
import { isCategory } from '#lib/shared/payloads.js';
import { pageFrom, paginate } from '#lib/pagination.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const category = url.searchParams.get('discipline') || undefined;
	if (category && !isCategory(category)) error(404);
	const sortParam = url.searchParams.get('tri');
	const sort =
		sortParam === 'contradictoires'
			? 'contested'
			: sortParam === 'sans-reponse'
				? 'unanswered'
				: 'recent';
	return {
		category: category ?? null,
		sort,
		...(await paginate(pageFrom(url), 30, (limit, offset) =>
			listQuestions({ category, sort, limit, offset })
		))
	} as const;
};
