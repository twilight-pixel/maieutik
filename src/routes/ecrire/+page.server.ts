import { error } from '@sveltejs/kit';
import { getQuestion, getText } from '#lib/server/repository.js';
import { RELATION_KINDS, type RelationKind } from '#lib/shared/content.js';
import { isUuid } from '#lib/shared/payloads.js';
import type { PageServerLoad } from './$types';

/**
 * - `?texte=<id>` : nouvelle version d'un texte ;
 * - `?reponse=<id>&relation=<type>` : texte en relation avec un autre (réfute, complète…) ;
 * - `?question=<id>` : position sur une question.
 */
export const load: PageServerLoad = async ({ url }) => {
	const textId = url.searchParams.get('texte');
	const targetId = url.searchParams.get('reponse');
	const questionId = url.searchParams.get('question');
	const relationParam = url.searchParams.get('relation') ?? 'replies-to';
	const relation: RelationKind = (RELATION_KINDS as readonly string[]).includes(relationParam)
		? (relationParam as RelationKind)
		: 'replies-to';

	if (textId) {
		if (!isUuid(textId)) error(404);
		const text = await getText(textId);
		if (!text?.payload || text.status !== 'published') error(404);
		return {
			mode: 'version' as const,
			base: text.payload,
			author: text.author.key,
			target: null,
			relation: text.payload.relation?.kind ?? null,
			question: text.question?.isPosition
				? { id: text.question.id, title: text.question.title }
				: null
		};
	}
	if (targetId) {
		if (!isUuid(targetId)) error(404);
		const target = await getText(targetId);
		if (!target?.payload || target.status !== 'published') error(404);
		return {
			mode: 'reply' as const,
			base: null,
			author: null,
			target: {
				id: target.id,
				title: target.payload.title,
				category: target.category,
				lang: target.lang,
				kind: target.kind,
				author: target.author,
				// Une traduction part du texte original.
				body: relation === 'translation-of' ? target.payload.body : null,
				sources: relation === 'translation-of' ? target.payload.sources : []
			},
			relation,
			question: null
		};
	}
	if (questionId) {
		if (!isUuid(questionId)) error(404);
		const question = await getQuestion(questionId);
		if (!question || question.status !== 'published') error(404);
		return {
			mode: 'position' as const,
			base: null,
			author: null,
			target: null,
			relation: null,
			question: {
				id: question.id,
				title: question.title,
				category: question.category,
				lang: question.lang
			}
		};
	}
	return {
		mode: 'new' as const,
		base: null,
		author: null,
		target: null,
		relation: null,
		question: null
	};
};
