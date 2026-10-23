import { json } from '@sveltejs/kit';
import { ApiError, errorResponse, readSignedRequest } from '#lib/server/api.js';
import { limits } from '#lib/server/rate-limit.js';
import { createAppeal } from '#lib/server/repository.js';
import { validateAppeal } from '#lib/shared/payloads.js';
import type { RequestHandler } from './$types';

/** Recours de l'auteur contre une décision visant son texte, examiné par le référent (D18). */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { verified } = await readSignedRequest(request, 'appeal');
		const payload = validateAppeal(verified.payload);
		if (!payload.ok) throw new ApiError(400, payload.error);
		if (!limits.reports.take(verified.envelope.publicKey)) {
			throw new ApiError(429, 'Trop de demandes récentes : réessayez plus tard');
		}
		await createAppeal(verified.publicKey, payload.value, verified.envelope);
		return json({ status: 'received' }, { status: 201 });
	} catch (error) {
		return errorResponse(error);
	}
};
