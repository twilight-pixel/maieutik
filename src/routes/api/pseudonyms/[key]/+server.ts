import { error, json } from '@sveltejs/kit';
import { getPseudonym } from '#lib/server/repository.js';
import { decodeKey } from '#lib/shared/signature.js';
import type { RequestHandler } from './$types';

/** Informations publiques d'un pseudonyme (utilisé à l'import d'une phrase de récupération). */
export const GET: RequestHandler = async ({ params }) => {
	let publicKey: Uint8Array;
	try {
		publicKey = decodeKey(params.key);
	} catch {
		error(404);
	}
	const pseudonym = await getPseudonym(publicKey);
	if (!pseudonym) error(404);
	return json({
		displayName: pseudonym.displayName,
		fingerprint: pseudonym.fingerprint,
		movedTo: pseudonym.movedTo?.key ?? null
	});
};
