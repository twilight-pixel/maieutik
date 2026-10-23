import { listDecisions } from '#lib/server/repository.js';
import { pageFrom, paginate } from '#lib/pagination.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) =>
	paginate(pageFrom(url), 50, (limit, offset) => listDecisions(limit, offset));
