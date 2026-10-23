import { json } from '@sveltejs/kit';
import { ApiError, errorResponse, readSignedRequest } from '#lib/server/api.js';
import { castVote } from '#lib/server/jury.js';
import { validateJuryVote } from '#lib/shared/payloads.js';
import type { RequestHandler } from './$types';

/** Vote à l'aveugle d'un juré, signé et motivé (docs/05). */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { verified } = await readSignedRequest(request, 'jury-vote');
		const payload = validateJuryVote(verified.payload);
		if (!payload.ok) throw new ApiError(400, payload.error);
		await castVote(verified.publicKey, payload.value, verified.envelope);
		return json({ status: 'recorded' }, { status: 201 });
	} catch (error) {
		return errorResponse(error);
	}
};
