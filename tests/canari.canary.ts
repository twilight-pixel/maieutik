/**
 * Canari des écritures (invariants I1 et I11, docs/09 §3).
 *
 * Toutes les requêtes portent un User-Agent et une adresse IP témoins. Après ce test, la CI
 * vérifie qu'ils n'apparaissent ni dans les journaux du serveur ni dans `pg_dump`.
 * Lancé contre le serveur de production local : `playwright test -c tests/canari.config.ts`.
 */
import { expect, test } from '@playwright/test';
import { createMnemonic, derivePseudonymKeypair, mnemonicToSeed } from '../src/lib/shared/identity';
import { sign } from '../src/lib/shared/signature';
import { solveChallenge, type PowChallenge } from '../src/lib/shared/pow';
import type { TextVersionPayload } from '../src/lib/shared/payloads';

const CANARY_UA = process.env.CANARY_UA ?? 'maieutik-canari-ua-7f3a9c';
const CANARY_IP = process.env.CANARY_IP ?? '203.0.113.77';

test.use({
	userAgent: CANARY_UA,
	extraHTTPHeaders: {
		'X-Forwarded-For': CANARY_IP,
		'X-Real-IP': CANARY_IP,
		Forwarded: `for=${CANARY_IP}`
	}
});

test('écritures signées avec des en-têtes témoins', async ({ request }) => {
	const author = derivePseudonymKeypair(mnemonicToSeed(createMnemonic()));

	const challenge = (await (await request.get('/api/pow')).json()) as PowChallenge;
	const pow = await solveChallenge(challenge);
	const pseudonym = await request.post('/api/pseudonyms', {
		data: { envelope: sign('pseudonym', { displayName: 'Canari' }, author.secretKey), pow }
	});
	expect(pseudonym.status()).toBe(201);

	const text: TextVersionPayload = {
		textId: crypto.randomUUID(),
		version: 1,
		category: 'philosophy/ethics',
		lang: 'fr',
		kind: 'essay',
		title: 'Texte témoin',
		body: {
			type: 'doc',
			content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rien à signaler.' }] }]
		},
		tags: [],
		warnings: [],
		relation: null,
		question: null,
		sources: [],
		deferred: false
	};
	const published = await request.post('/api/texts', {
		data: { envelope: sign('text-version', text, author.secretKey) }
	});
	expect(published.status()).toBe(201);

	// Requête refusée : les chemins d'erreur ne doivent rien journaliser d'identifiant non plus.
	expect((await request.post('/api/texts', { data: { envelope: null } })).status()).toBe(400);

	for (const path of ['/', '/en', '/disciplines?q=t%C3%A9moin', '/page-inexistante']) {
		await request.get(path);
	}
});
