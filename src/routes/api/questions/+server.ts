import { json } from '@sveltejs/kit';
import { ApiError, errorResponse, readSignedRequest } from '#lib/server/api.js';
import { limits } from '#lib/server/rate-limit.js';
import { createQuestion } from '#lib/server/repository.js';
import { validateQuestion } from '#lib/shared/payloads.js';
import type { RequestHandler } from './$types';

/** Nouvelle question, posée par n'importe quel pseudonyme (docs/04 §4). */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { verified } = await readSignedRequest(request, 'question');
		const payload = validateQuestion(verified.payload);
		if (!payload.ok) throw new ApiError(400, payload.error);
		if (!limits.questions.take(verified.envelope.publicKey)) {
			throw new ApiError(429, 'Trop de questions récentes : réessayez plus tard');
		}
		const status = await createQuestion(verified.publicKey, payload.value, verified.envelope);
		return json(
			{ id: payload.value.questionId, status },
			{ status: status === 'created' ? 201 : 200 }
		);
	} catch (error) {
		return errorResponse(error);
	}
};
