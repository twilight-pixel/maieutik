import { json } from '@sveltejs/kit';
import { requireArchiver } from '#lib/server/archiver.js';
import { claimArchiveJobs } from '#lib/server/repository.js';
import type { RequestHandler } from './$types';

/** Adresses à archiver, réservées pour le robot (interface interne, docs/08). */
export const POST: RequestHandler = async ({ request }) => {
	requireArchiver(request);
	return json({ urls: await claimArchiveJobs(10) }, { headers: { 'cache-control': 'no-store' } });
};
