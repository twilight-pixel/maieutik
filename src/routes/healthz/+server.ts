import type { RequestHandler } from './$types';
import { sql } from '#lib/server/db.js';

/** Sonde de santé du conteneur (deploy/compose.yaml) : vérifie l'accès à la base. */
export const GET: RequestHandler = async () => {
	try {
		await sql`select 1`;
		return new Response('ok', { headers: { 'cache-control': 'no-store' } });
	} catch {
		return new Response('indisponible', { status: 503 });
	}
};
