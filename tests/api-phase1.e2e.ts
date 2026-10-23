/**
 * Parcours complet de l'API de la phase 1, avec de vraies signatures :
 * pseudonyme → publication → version → réponse → signalement → décision → retrait.
 */
import { expect, test, type APIRequestContext } from '@playwright/test';
import { createMnemonic, derivePseudonymKeypair, mnemonicToSeed } from '../src/lib/shared/identity';
import { sign, type SignedKind } from '../src/lib/shared/signature';
import { solveChallenge, type PowChallenge } from '../src/lib/shared/pow';
import type { JsonValue } from '../src/lib/shared/canonical-json';
import type { TextVersionPayload } from '../src/lib/shared/payloads';
import { referent } from './fixtures';

test.describe.configure({ mode: 'serial' });

const author = derivePseudonymKeypair(mnemonicToSeed(createMnemonic()));
const reader = derivePseudonymKeypair(mnemonicToSeed(createMnemonic()));

async function register(request: APIRequestContext, secretKey: Uint8Array, displayName: string) {
	const challenge = (await (await request.get('/api/pow')).json()) as PowChallenge;
	const pow = await solveChallenge(challenge);
	return request.post('/api/pseudonyms', {
		data: { envelope: sign('pseudonym', { displayName }, secretKey), pow }
	});
}

function post(
	request: APIRequestContext,
	path: string,
	kind: SignedKind,
	payload: JsonValue,
	key: Uint8Array
) {
	return request.post(path, { data: { envelope: sign(kind, payload, key) } });
}

const textId = crypto.randomUUID();
const replyId = crypto.randomUUID();
const body = (text: string): TextVersionPayload['body'] => ({
	type: 'doc',
	content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
});
const first: TextVersionPayload = {
	textId,
	version: 1,
	category: 'philosophy/ethics',
	lang: 'fr',
	kind: 'essay',
	title: 'De la liberté de penser',
	body: body('La liberté de penser suppose la liberté d’écrire.'),
	tags: ['liberté'],
	warnings: [],
	relation: null,
	question: null,
	sources: [],
	deferred: false
};

test('création des pseudonymes avec preuve de travail', async ({ request }) => {
	expect((await register(request, author.secretKey, 'Hypatie')).status()).toBe(201);
	expect((await register(request, reader.secretKey, 'Lecteur')).status()).toBe(201);
	expect((await register(request, referent.secretKey, 'Référent')).status()).toBeLessThan(300);
	// Sans preuve de travail : refusé.
	const noPow = await request.post('/api/pseudonyms', {
		data: { envelope: sign('pseudonym', { displayName: 'Robot' }, reader.secretKey) }
	});
	expect(noPow.status()).toBe(400);
});

test('publication, nouvelle version et lecture publique', async ({ request }) => {
	expect(
		(await post(request, '/api/texts', 'text-version', first, author.secretKey)).status()
	).toBe(201);

	// Un tiers ne peut pas publier une version du texte d'un autre.
	const forged = { ...first, version: 2, title: 'Usurpé' };
	expect(
		(await post(request, '/api/texts', 'text-version', forged, reader.secretKey)).status()
	).toBe(403);

	const second = { ...first, version: 2, body: body('Version revue : penser, c’est déjà écrire.') };
	expect(
		(await post(request, '/api/texts', 'text-version', second, author.secretKey)).status()
	).toBe(201);
	// Rejouer la version 2 est refusé.
	expect(
		(await post(request, '/api/texts', 'text-version', second, author.secretKey)).status()
	).toBe(409);

	const page = await request.get(`/textes/${textId}`);
	expect(page.status()).toBe(200);
	const html = await page.text();
	expect(html).toContain('De la liberté de penser');
	expect(html).toContain('Version revue');
	expect(await (await request.get(`/textes/${textId}/versions/1`)).text()).toContain(
		'suppose la liberté'
	);
});

test('réponse liée et recherche plein texte', async ({ request }) => {
	const reply: TextVersionPayload = {
		...first,
		textId: replyId,
		title: 'Réponse sur la liberté',
		body: body('Écrire ne suffit pas : encore faut-il être lu.'),
		relation: { kind: 'replies-to', target: textId }
	};
	expect(
		(await post(request, '/api/texts', 'text-version', reply, reader.secretKey)).status()
	).toBe(201);
	expect(await (await request.get(`/textes/${textId}`)).text()).toContain('Réponse sur la liberté');
	expect(await (await request.get('/disciplines?q=lu')).text()).toContain('Réponse sur la liberté');
});

test('signalement puis décision motivée du référent', async ({ request }) => {
	const report = {
		reportId: crypto.randomUUID(),
		textId: replyId,
		version: 1,
		category: 'missing-warning',
		passage: 'Écrire ne suffit pas',
		justification: 'Test de bout en bout.'
	};
	expect((await post(request, '/api/reports', 'report', report, author.secretKey)).status()).toBe(
		201
	);

	// Seul le référent voit les signalements.
	const access = { requestedAt: Date.now() };
	expect(
		(
			await post(request, '/api/referent/reports', 'referent-access', access, author.secretKey)
		).status()
	).toBe(403);
	const listed = await post(
		request,
		'/api/referent/reports',
		'referent-access',
		access,
		referent.secretKey
	);
	expect(listed.status()).toBe(200);
	expect(
		((await listed.json()) as { reports: { id: string }[] }).reports.map((r) => r.id)
	).toContain(report.reportId);

	const decision = {
		decisionId: crypto.randomUUID(),
		reportId: report.reportId,
		appealId: null,
		textId: replyId,
		questionId: null,
		category: 'missing-warning',
		legalBasis: 'Règles de la plateforme, avertissements (docs/06)',
		reasoning: 'Avertissement ajouté à titre de test.',
		outcome: 'warning_added',
		warning: 'sensitive-topics'
	};
	expect(
		(
			await post(request, '/api/decisions', 'moderation-decision', decision, author.secretKey)
		).status()
	).toBe(403);
	expect(
		(
			await post(request, '/api/decisions', 'moderation-decision', decision, referent.secretKey)
		).status()
	).toBe(201);
	expect(await (await request.get('/journal')).text()).toContain(
		'Avertissement ajouté à titre de test.'
	);
});

test('retrait par l’auteur : le corps disparaît, la trace reste', async ({ request }) => {
	expect(
		(
			await post(request, '/api/withdrawals', 'text-withdrawal', { textId }, reader.secretKey)
		).status()
	).toBe(403);
	expect(
		(
			await post(request, '/api/withdrawals', 'text-withdrawal', { textId }, author.secretKey)
		).status()
	).toBe(200);
	const html = await (await request.get(`/textes/${textId}`)).text();
	expect(html).not.toContain('penser, c’est déjà écrire');
	expect(html).toContain('Réponse sur la liberté');
});
