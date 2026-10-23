import { error } from '@sveltejs/kit';
import { getSnapshot } from '#lib/server/repository.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const target = url.searchParams.get('url');
	if (!target) error(404);
	const snapshot = await getSnapshot(target);
	if (!snapshot || snapshot.status !== 'archived') error(404);
	return { snapshot };
};
