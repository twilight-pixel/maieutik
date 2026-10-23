import { json } from '@sveltejs/kit';
import { ApiError, errorResponse, readSignedRequest } from '#lib/server/api.js';
import { setVolunteer } from '#lib/server/jury.js';
import { validateJuryVolunteer } from '#lib/shared/payloads.js';
import type { RequestHandler } from './$types';

/** Se porter volontaire pour les jurys, ou se retirer (docs/05). */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { verified } = await readSignedRequest(request, 'jury-volunteer');
		const payload = validateJuryVolunteer(verified.payload);
		if (!payload.ok) throw new ApiError(400, payload.error);
		await setVolunteer(verified.publicKey, payload.value.available);
		return json({ available: payload.value.available });
	} catch (error) {
		return errorResponse(error);
	}
};
