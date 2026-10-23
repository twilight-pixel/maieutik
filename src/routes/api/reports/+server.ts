import { json } from '@sveltejs/kit';
import { ApiError, errorResponse, readSignedRequest } from '#lib/server/api.js';
import { limits } from '#lib/server/rate-limit.js';
import { createReport } from '#lib/server/repository.js';
import { validateReport } from '#lib/shared/payloads.js';
import type { RequestHandler } from './$types';

/** Signalement motivé (niveau 1, docs/05) : catégorie légale, passage, justification. */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { verified } = await readSignedRequest(request, 'report');
		const payload = validateReport(verified.payload);
		if (!payload.ok) throw new ApiError(400, payload.error);
		if (!limits.reports.take(verified.envelope.publicKey)) {
			throw new ApiError(429, 'Trop de signalements récents : réessayez plus tard');
		}
		const route = await createReport(verified.publicKey, payload.value, verified.envelope);
		return json({ status: 'received', route }, { status: 201 });
	} catch (error) {
		return errorResponse(error);
	}
};
