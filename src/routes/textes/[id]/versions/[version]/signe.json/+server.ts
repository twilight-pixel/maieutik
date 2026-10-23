import { error, json } from '@sveltejs/kit';
import { getText } from '#lib/server/repository.js';
import { isUuid } from '#lib/shared/payloads.js';
import type { RequestHandler } from './$types';

/**
 * Version signée telle que reçue de l'auteur : vérifiable par n'importe qui avec la clé
 * publique (données signées et exportables, docs/08).
 */
export const GET: RequestHandler = async ({ params }) => {
	const version = Number(params.version);
	if (!isUuid(params.id) || !Number.isInteger(version) || version < 1) error(404);
	const text = await getText(params.id, version);
	if (!text?.envelope) error(404);
	return json(text.envelope, {
		headers: { 'content-disposition': `attachment; filename="${params.id}-v${version}.json"` }
	});
};
