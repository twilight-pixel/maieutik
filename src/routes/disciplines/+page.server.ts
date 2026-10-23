import { listTexts, searchTexts } from '#lib/server/repository.js';
import { pageFrom, paginate } from '#lib/pagination.js';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 20;

// Recherche plein texte (Postgres, FR et EN) : formulaire GET, sans JavaScript.
// Sans requête, la page propose le flux des textes récemment discutés (même tri que les disciplines).
export const load: PageServerLoad = async ({ url }) => {
	const query = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	const langParam = url.searchParams.get('langue');
	const lang = langParam === 'fr' || langParam === 'en' ? langParam : undefined;
	const page = pageFrom(url);
	if (query) {
		const results = await paginate(page, PAGE_SIZE, (limit, offset) =>
			searchTexts(query, { lang, limit, offset })
		);
		return {
			query,
			lang: lang ?? null,
			results: results.items,
			feed: null,
			page,
			hasNext: results.hasNext
		};
	}

	const texts = await listTexts({
		sort: 'activity',
		limit: PAGE_SIZE + 1,
		offset: (page - 1) * PAGE_SIZE
	});
	return {
		query,
		lang: null,
		results: null,
		feed: texts.slice(0, PAGE_SIZE),
		page,
		hasNext: texts.length > PAGE_SIZE
	};
};
