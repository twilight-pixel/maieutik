/**
 * Phase 2 : questions et positions, relations typées, signaux de découverte,
 * traductions, sources structurées et interface interne du robot d'archivage.
 */
import { expect, test, type APIRequestContext } from '@playwright/test';
import { createMnemonic, derivePseudonymKeypair, mnemonicToSeed } from '../src/lib/shared/identity';
import { sign } from '../src/lib/shared/signature';
import { solveChallenge, type PowChallenge } from '../src/lib/shared/pow';
import type { TextVersionPayload } from '../src/lib/shared/payloads';
import { ARCHIVER_TOKEN } from './fixtures';

test.describe.configure({ mode: 'serial' });

const alice = derivePseudonymKeypair(mnemonicToSeed(createMnemonic()));
const bob = derivePseudonymKeypair(mnemonicToSeed(createMnemonic()));

async function register(request: APIRequestContext, secretKey: Uint8Array, displayName: string) {
	const challenge = (await (await request.get('/api/pow')).json()) as PowChallenge;
	const pow = await solveChallenge(challenge);
	const response = await request.post('/api/pseudonyms', {
		data: { envelope: sign('pseudonym', { displayName }, secretKey), pow }
	});
	expect(response.status()).toBeLessThan(300);
}

const doc = (text: string, cite = false): TextVersionPayload['body'] => ({
	type: 'doc',
	content: [
		{
			type: 'paragraph',
			content: [
				{ type: 'text', text },
				...(cite
					? [
							{
								type: 'text' as const,
								text: 'selon la source',
								marks: [{ type: 'sourceRef' as const, attrs: { source: 's1' } }]
							}
						]
					: [])
			]
		}
	]
});

function text(patch: Partial<TextVersionPayload>): TextVersionPayload {
	return {
		textId: crypto.randomUUID(),
		version: 1,
		category: 'politics/institutions',
		lang: 'fr',
		kind: 'essay',
		title: 'Sans titre',
		body: doc('Contenu.'),
		tags: [],
		warnings: [],
		relation: null,
		question: null,
		sources: [],
		deferred: false,
		...patch
	};
}

const publish = (request: APIRequestContext, payload: TextVersionPayload, key: Uint8Array) =>
	request.post('/api/texts', { data: { envelope: sign('text-version', payload, key) } });

const questionId = crypto.randomUUID();
// Adresse unique par exécution : l'archivage est dédupliqué par adresse.
const sourceUrl = `https://example.org/contre-les-elections?essai=${questionId}`;
const positionA = text({
	title: 'Le tirage au sort renforce la démocratie',
	body: doc('Il donne une voix égale à chacun. ', true),
	question: questionId,
	sources: [
		{
			id: 's1',
			title: 'Contre les élections',
			author: 'David Van Reybrouck',
			date: '2013',
			publisher: null,
			url: sourceUrl
		}
	]
});
const positionB = text({ title: 'L’élection reste indispensable', question: questionId });
const refutation = text({
	title: 'Le tirage au sort ignore la compétence',
	relation: { kind: 'refutes', target: positionA.textId }
});

test('question et positions en présence', async ({ request }) => {
	await register(request, alice.secretKey, 'Alice');
	await register(request, bob.secretKey, 'Bob');

	const question = {
		questionId,
		title: 'Faut-il tirer au sort une assemblée ?',
		category: 'politics/institutions',
		lang: 'fr',
		context: 'Plusieurs pays expérimentent des conventions citoyennes.'
	};
	const created = await request.post('/api/questions', {
		data: { envelope: sign('question', question, alice.secretKey) }
	});
	expect(created.status()).toBe(201);

	expect((await publish(request, positionA, alice.secretKey)).status()).toBe(201);
	expect((await publish(request, positionB, bob.secretKey)).status()).toBe(201);

	const page = await (await request.get(`/questions/${questionId}`)).text();
	expect(page).toContain('Faut-il tirer au sort une assemblée ?');
	expect(page).toContain('Le tirage au sort renforce la démocratie');
	expect(page).toContain('L’élection reste indispensable');
	expect(await (await request.get('/questions?discipline=politics')).text()).toContain(
		'Faut-il tirer au sort'
	);
});

test('réfutation sans réponse, puis discutée', async ({ request }) => {
	expect((await publish(request, refutation, bob.secretKey)).status()).toBe(201);

	expect(await (await request.get('/a-repondre')).text()).toContain(
		'Le tirage au sort ignore la compétence'
	);
	const question = await (await request.get(`/questions/${questionId}`)).text();
	expect(question).toContain('réfutation sans réponse');

	// La page du texte réfuté regroupe les réponses par nature.
	const target = await (await request.get(`/textes/${positionA.textId}`)).text();
	// Titre de groupe : nature de la relation (glyphe et libellé), puis le nombre de textes.
	expect(target).toMatch(/Réfutations<\/span>(<!---->)?\s*<span class="count[^"]*">1</);
	// La réfutation hérite de la question de la position qu'elle discute.
	expect(await (await request.get(`/textes/${refutation.textId}`)).text()).toContain(
		'Discussion sur la question'
	);

	const answer = text({
		title: 'La compétence se construit',
		relation: { kind: 'refutes', target: refutation.textId }
	});
	expect((await publish(request, answer, alice.secretKey)).status()).toBe(201);
	// La réfutation discutée n'est plus une entrée de la liste ; la contre-réfutation l'est,
	// et cite l'ancienne réfutation comme cible (entre guillemets).
	const after = await (await request.get('/a-repondre')).text();
	// On teste CETTE réfutation (par son identifiant), pas le titre : la base de test garde les
	// passages précédents, dont des réfutations du même titre restées sans réponse.
	const asEntry = new RegExp(`/textes/${refutation.textId}"[^>]*>Le tirage au sort ignore`);
	expect(after).not.toMatch(asEntry);
	expect(after).toContain('La compétence se construit');
});

test('traduction dans une autre langue uniquement', async ({ request }) => {
	const sameLang = text({
		title: 'Traduction ratée',
		relation: { kind: 'translation-of', target: positionB.textId }
	});
	expect((await publish(request, sameLang, bob.secretKey)).status()).toBe(400);

	const translation = text({
		title: 'Elections remain essential',
		lang: 'en',
		relation: { kind: 'translation-of', target: positionB.textId }
	});
	expect((await publish(request, translation, bob.secretKey)).status()).toBe(201);
	expect(await (await request.get(`/textes/${positionB.textId}`)).text()).toContain(
		'Elections remain essential'
	);
});

test('sources : file d’archivage et instantané textuel', async ({ request }) => {
	const source = sourceUrl;
	const before = await (await request.get(`/textes/${positionA.textId}`)).text();
	expect(before).toContain('Contre les élections');
	expect(before).toContain('archivage en attente');

	// Sans jeton, l'interface interne n'existe pas.
	expect((await request.post('/internal/archive/jobs', { data: {} })).status()).toBe(404);
	expect(
		(
			await request.post('/internal/archive/jobs', {
				headers: { authorization: 'Bearer mauvais-jeton' },
				data: {}
			})
		).status()
	).toBe(404);

	const auth = { authorization: `Bearer ${ARCHIVER_TOKEN}` };
	const jobs = (await (
		await request.post('/internal/archive/jobs', { headers: auth, data: {} })
	).json()) as {
		urls: string[];
	};
	expect(jobs.urls).toContain(source);
	const saved = await request.post('/internal/archive/results', {
		headers: auth,
		data: {
			url: source,
			status: 'archived',
			contentType: 'text/html',
			sha256: 'a'.repeat(64),
			title: 'Contre les élections',
			text: 'Texte archivé de la source.'
		}
	});
	expect(saved.status()).toBe(200);

	const after = await (await request.get(`/textes/${positionA.textId}`)).text();
	expect(after).toContain('instantané du');
	const snapshot = await request.get(`/instantanes?url=${encodeURIComponent(source)}`);
	expect(snapshot.status()).toBe(200);
	expect(await snapshot.text()).toContain('Texte archivé de la source.');
});
