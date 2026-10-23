import { json } from '@sveltejs/kit';
import { errorResponse, readSignedRequest } from '#lib/server/api.js';
import { requireFreshAccess, requireReferent } from '#lib/server/referent.js';
import { closeDueJuries } from '#lib/server/jury.js';
import { listOpenAppeals, listOpenReports } from '#lib/server/repository.js';
import type { RequestHandler } from './$types';

/**
 * Signalements en attente, réservés au référent. Ils ne sont jamais publics : l'identité
 * des signaleurs est protégée. Requête POST signée plutôt qu'une session.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { verified } = await readSignedRequest(request, 'referent-access');
		requireReferent(verified);
		requireFreshAccess(verified.payload);
		// Les jurys échus sans quorum reviennent au référent.
		await closeDueJuries();
		return json(
			{ reports: await listOpenReports(), appeals: await listOpenAppeals() },
			{ headers: { 'cache-control': 'no-store' } }
		);
	} catch (error) {
		return errorResponse(error);
	}
};
