import { json } from '@sveltejs/kit';
import { TEAM_KEYS } from '$app/env/private';
import { ApiError, errorResponse, readSignedRequest } from '#lib/server/api.js';
import { createInvitations } from '#lib/server/invitations.js';
import { isReferent, requireFreshAccess } from '#lib/server/referent.js';
import { validateInvitationRequest } from '#lib/shared/payloads.js';
import type { RequestHandler } from './$types';

/**
 * Création de codes d'invitation, réservée au référent et à l'équipe (docs/07).
 * Les codes ne sont renvoyés qu'une fois : seule leur empreinte est conservée.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { verified } = await readSignedRequest(request, 'invitation-create');
		const key = verified.envelope.publicKey;
		if (!isReferent(key) && !TEAM_KEYS.includes(key)) {
			throw new ApiError(403, 'Réservé au référent et à l’équipe');
		}
		const payload = validateInvitationRequest(verified.payload);
		if (!payload.ok) throw new ApiError(400, payload.error);
		requireFreshAccess(payload.value);
		return json(
			{ codes: await createInvitations(payload.value.count) },
			{ status: 201, headers: { 'cache-control': 'no-store' } }
		);
	} catch (error) {
		return errorResponse(error);
	}
};
