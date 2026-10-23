import { error } from '@sveltejs/kit';
import { getQuestion } from '#lib/server/repository.js';
import { isUuid } from '#lib/shared/payloads.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	if (!isUuid(params.id)) error(404);
	const question = await getQuestion(params.id);
	if (!question || question.status !== 'published') error(404);
	return { question };
};
