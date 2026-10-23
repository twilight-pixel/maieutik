import { json } from '@sveltejs/kit';
import { ApiError, errorResponse, readSignedRequest } from '#lib/server/api.js';
import { requireReferent } from '#lib/server/referent.js';
import { applyDecision } from '#lib/server/repository.js';
import { validateDecision } from '#lib/shared/payloads.js';
import type { RequestHandler } from './$types';

/** Décision motivée du référent juridique, inscrite au journal public (DSA art. 17). */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { verified } = await readSignedRequest(request, 'moderation-decision');
		requireReferent(verified);
		const payload = validateDecision(verified.payload);
		if (!payload.ok) throw new ApiError(400, payload.error);
		await applyDecision(verified.publicKey, payload.value, verified.envelope);
		return json({ status: 'applied' }, { status: 201 });
	} catch (error) {
		return errorResponse(error);
	}
};
