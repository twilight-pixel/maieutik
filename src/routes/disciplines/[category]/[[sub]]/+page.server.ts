import { error } from '@sveltejs/kit';
import { listTexts } from '#lib/server/repository.js';
import { isCategory } from '#lib/shared/payloads.js';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 30;

export const load: PageServerLoad = async ({ params, url }) => {
	const category = params.sub ? `${params.category}/${params.sub}` : params.category;
	if (!isCategory(category)) error(404);
	const sort = url.searchParams.get('tri') === 'chronologique' ? 'recent' : 'activity';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const texts = await listTexts({
		category,
		sort,
		limit: PAGE_SIZE + 1,
		offset: (page - 1) * PAGE_SIZE
	});
	return {
		category,
		top: params.category,
		sort,
		page,
		texts: texts.slice(0, PAGE_SIZE),
		hasNext: texts.length > PAGE_SIZE
	};
};
