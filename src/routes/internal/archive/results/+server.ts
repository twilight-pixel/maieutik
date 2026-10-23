import { error, json } from '@sveltejs/kit';
import { requireArchiver } from '#lib/server/archiver.js';
import { saveArchiveResult, type ArchiveResult } from '#lib/server/repository.js';
import type { RequestHandler } from './$types';

const MAX_TEXT = 500_000;

/** Résultat d'archivage d'une adresse : instantané textuel, échec ou refus. */
export const POST: RequestHandler = async ({ request }) => {
	requireArchiver(request);
	const body = (await request.json().catch(() => null)) as Partial<ArchiveResult> & {
		contentType?: unknown;
		sha256?: unknown;
		title?: unknown;
		text?: unknown;
	};
	if (!body || typeof body.url !== 'string') error(400);
	if (body.status === 'failed' || body.status === 'refused') {
		await saveArchiveResult({ url: body.url, status: body.status });
	} else if (
		body.status === 'archived' &&
		typeof body.contentType === 'string' &&
		typeof body.sha256 === 'string' &&
		/^[0-9a-f]{64}$/.test(body.sha256) &&
		(body.title === null || typeof body.title === 'string') &&
		typeof body.text === 'string'
	) {
		await saveArchiveResult({
			url: body.url,
			status: 'archived',
			contentType: body.contentType.slice(0, 100),
			sha256: body.sha256,
			title: body.title?.slice(0, 300) ?? null,
			text: body.text.slice(0, MAX_TEXT)
		});
	} else {
		error(400);
	}
	return json({ status: 'saved' });
};
