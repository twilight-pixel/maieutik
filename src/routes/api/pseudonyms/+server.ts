import { json } from '@sveltejs/kit';
import { TEAM_KEYS } from '$app/env/private';
import { ApiError, errorResponse, readSignedRequest } from '#lib/server/api.js';
import { invitationHash, invitationsRequired } from '#lib/server/invitations.js';
import { claimChallenge } from '#lib/server/rate-limit.js';
import { registerPseudonym } from '#lib/server/repository.js';
import { powKey } from '#lib/server/secrets.js';
import { validatePseudonym } from '#lib/shared/payloads.js';
import { verifySolution, type PowSolution } from '#lib/shared/pow.js';
import type { RequestHandler } from './$types';

/**
 * Création d'un pseudonyme : déclaration signée + preuve de travail (docs/03), et code
 * d'invitation quand le démarrage l'exige (docs/07). Les clés listées dans TEAM_KEYS sont
 * des pseudonymes d'équipe, affichés comme tels.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { verified, body } = await readSignedRequest(request, 'pseudonym');
		const payload = validatePseudonym(verified.payload);
		if (!payload.ok) throw new ApiError(400, payload.error);

		const pow = body.pow as PowSolution | undefined;
		if (!pow || !verifySolution(powKey, pow)) {
			throw new ApiError(400, 'Preuve de travail invalide ou expirée');
		}
		const expires = Number(new URLSearchParams(pow.salt.split('?')[1]).get('expires')) * 1000;
		if (!claimChallenge(pow.challenge, expires)) {
			throw new ApiError(400, 'Preuve de travail déjà utilisée');
		}

		const isTeam = TEAM_KEYS.includes(verified.envelope.publicKey);
		const invitation = typeof body.invitation === 'string' ? body.invitation.trim() : '';
		if (invitationsRequired() && !isTeam && !invitation) {
			throw new ApiError(403, 'Un code d’invitation est nécessaire pour le moment');
		}

		const status = await registerPseudonym(
			verified.publicKey,
			payload.value.displayName,
			verified.envelope,
			{
				isTeam,
				invitationHash: invitationsRequired() && !isTeam ? invitationHash(invitation) : null
			}
		);
		return json({ status }, { status: status === 'created' ? 201 : 200 });
	} catch (error) {
		return errorResponse(error);
	}
};

/** Conditions d'inscription en vigueur (affichées avant la preuve de travail). */
export const GET: RequestHandler = () =>
	json({ invitationRequired: invitationsRequired() }, { headers: { 'cache-control': 'no-store' } });
