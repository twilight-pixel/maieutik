import { error, json } from '@sveltejs/kit';
import { exportPseudonym } from '#lib/server/repository.js';
import { decodeKey } from '#lib/shared/signature.js';
import type { RequestHandler } from './$types';

/**
 * Export intégral d'un pseudonyme : enveloppes signées de ses textes, versions, questions,
 * déclaration et rotation. Chaque élément se vérifie avec la seule clé publique.
 */
export const GET: RequestHandler = async ({ params }) => {
	let publicKey: Uint8Array;
	try {
		publicKey = decodeKey(params.key);
	} catch {
		error(404);
	}
	const data = await exportPseudonym(publicKey);
	if (!data) error(404);
	return json(data, {
		headers: { 'content-disposition': `attachment; filename="maieutik-${params.key}.json"` }
	});
};
