import { json } from '@sveltejs/kit';
import { ApiError, errorResponse, readSignedRequest } from '#lib/server/api.js';
import { limits } from '#lib/server/rate-limit.js';
import { createQuestionReport } from '#lib/server/repository.js';
import { validateQuestionReport } from '#lib/shared/payloads.js';
import type { RequestHandler } from './$types';

/** Signalement d'une question, traité par le référent juridique (D18). */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { verified } = await readSignedRequest(request, 'question-report');
		const payload = validateQuestionReport(verified.payload);
		if (!payload.ok) throw new ApiError(400, payload.error);
		if (!limits.reports.take(verified.envelope.publicKey)) {
			throw new ApiError(429, 'Trop de signalements récents : réessayez plus tard');
		}
		await createQuestionReport(verified.publicKey, payload.value, verified.envelope);
		return json({ status: 'received', route: 'referent' }, { status: 201 });
	} catch (error) {
		return errorResponse(error);
	}
};
