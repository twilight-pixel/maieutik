import { json } from '@sveltejs/kit';
import { ApiError, errorResponse, readSignedRequest } from '#lib/server/api.js';
import { limits } from '#lib/server/rate-limit.js';
import { publishTextVersion } from '#lib/server/repository.js';
import { validateTextVersion } from '#lib/shared/payloads.js';
import type { RequestHandler } from './$types';

/** Publication d'un texte ou d'une nouvelle version, signée par l'auteur. */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { verified } = await readSignedRequest(request, 'text-version');
		const payload = validateTextVersion(verified.payload);
		if (!payload.ok) throw new ApiError(400, payload.error);
		if (!limits.texts.take(verified.envelope.publicKey)) {
			throw new ApiError(429, 'Trop de publications récentes : réessayez plus tard');
		}
		const result = await publishTextVersion(verified.publicKey, payload.value, verified.envelope);
		return json(
			{ id: payload.value.textId, version: payload.value.version, ...result },
			{ status: 201 }
		);
	} catch (error) {
		return errorResponse(error);
	}
};
