import { json } from '@sveltejs/kit';
import { ApiError, errorResponse, readSignedRequest } from '#lib/server/api.js';
import { getJurorStatus, listAssignments } from '#lib/server/jury.js';
import { requireFreshAccess } from '#lib/server/referent.js';
import type { RequestHandler } from './$types';

/**
 * Statut de juré et jurys en attente du vote de ce pseudonyme. Requête signée et horodatée :
 * personne d'autre ne peut savoir qui siège dans quel jury.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { verified } = await readSignedRequest(request, 'jury-access');
		requireFreshAccess(verified.payload);
		const status = await getJurorStatus(verified.publicKey);
		if (!status) throw new ApiError(403, 'Pseudonyme inconnu');
		return json(
			{ status, assignments: await listAssignments(verified.publicKey) },
			{ headers: { 'cache-control': 'no-store' } }
		);
	} catch (error) {
		return errorResponse(error);
	}
};
