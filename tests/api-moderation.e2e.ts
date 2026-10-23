/**
 * Compléments de modération et de démarrage (D18) : signalement de question, recours de
 * l'auteur, fiabilité des signaleurs, codes d'invitation, application installable.
 */
import { expect, test, type APIRequestContext } from '@playwright/test';
import { createMnemonic, derivePseudonymKeypair, mnemonicToSeed } from '../src/lib/shared/identity';
import { sign, type SignedKind } from '../src/lib/shared/signature';
import { solveChallenge, type PowChallenge } from '../src/lib/shared/pow';
import { JURY } from '../src/lib/shared/jury';
import type { JsonValue } from '../src/lib/shared/canonical-json';
import type { TextVersionPayload } from '../src/lib/shared/payloads';
import { referent } from './fixtures';
import { testDatabase } from './db';

test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

type Keys = ReturnType<typeof derivePseudonymKeypair>;
const newKeys = () => derivePseudonymKeypair(mnemonicToSeed(createMnemonic()));
const db = testDatabase();
test.afterAll(() => db.end());

async function register(request: APIRequestContext, keys: Keys, displayName: string) {
	const challenge = (await (await request.get('/api/pow')).json()) as PowChallenge;
	const pow = await solveChallenge(challenge);
	const response = await request.post('/api/pseudonyms', {
		data: { envelope: sign('pseudonym', { displayName }, keys.secretKey), pow }
	});
	expect(response.status(), await response.text()).toBeLessThan(300);
}

const post = (
	request: APIRequestContext,
	path: string,
	kind: SignedKind,
	payload: JsonValue,
	keys: Keys
) => request.post(path, { data: { envelope: sign(kind, payload, keys.secretKey) } });

const text = (title: string): TextVersionPayload => ({
	textId: crypto.randomUUID(),
	version: 1,
	category: 'society/law',
	lang: 'fr',
	kind: 'opinion',
	title,
	body: {
		type: 'doc',
		content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Contenu.' }] }]
	},
	tags: [],
	warnings: [],
	relation: null,
	question: null,
	sources: [],
	deferred: false
});

const decision = (patch: Record<string, unknown>) => ({
	decisionId: crypto.randomUUID(),
	reportId: null,
	appealId: null,
	textId: null,
	questionId: null,
	category: 'other-illegal',
	legalBasis: 'Test',
	reasoning: 'Décision de test.',
	outcome: 'maintained',
	warning: null,
	...patch
});

const author = newKeys();
const reporter = newKeys();

test('signalement d’une question, retrait motivé par le référent', async ({ request }) => {
	await register(request, author, 'Auteur');
	await register(request, reporter, 'Signaleur');
	await register(request, referent, 'Référent');

	const questionId = crypto.randomUUID();
	await post(
		request,
		'/api/questions',
		'question',
		{
			questionId,
			title: 'Question au titre illicite ?',
			category: 'society',
			lang: 'fr',
			context: ''
		},
		author
	);
	const reportId = crypto.randomUUID();
	const report = await post(
		request,
		'/api/question-reports',
		'question-report',
		{ reportId, questionId, category: 'personal-data', justification: 'Adresse dans le titre.' },
		reporter
	);
	expect(report.status()).toBe(201);

	const listed = await post(
		request,
		'/api/referent/reports',
		'referent-access',
		{ requestedAt: Date.now() },
		referent
	);
	expect(listed.status(), await listed.text()).toBe(200);
	const { reports } = (await listed.json()) as { reports: { id: string; questionId: string }[] };
	expect(reports.find((r) => r.id === reportId)?.questionId).toBe(questionId);

	// Une question ne peut être que maintenue ou retirée.
	expect(
		(
			await post(
				request,
				'/api/decisions',
				'moderation-decision',
				decision({ reportId, questionId, category: 'personal-data', outcome: 'hidden' }),
				referent
			)
		).status()
	).toBe(400);
	expect(
		(
			await post(
				request,
				'/api/decisions',
				'moderation-decision',
				decision({ reportId, questionId, category: 'personal-data', outcome: 'removed' }),
				referent
			)
		).status()
	).toBe(201);
	expect((await request.get(`/questions/${questionId}`)).status()).toBe(404);
	expect(await (await request.get('/journal')).text()).toContain(questionId.slice(0, 8));
});

test('recours de l’auteur : seul l’auteur, puis texte rétabli', async ({ request }) => {
	const contested = text('Texte masqué à tort');
	await post(request, '/api/texts', 'text-version', contested, author);
	const hiddenId = crypto.randomUUID();
	await post(
		request,
		'/api/decisions',
		'moderation-decision',
		decision({ decisionId: hiddenId, textId: contested.textId, outcome: 'hidden' }),
		referent
	);
	expect(await (await request.get(`/textes/${contested.textId}`)).text()).toContain(
		'Texte masqué en attente d’examen'
	);

	const appeal = { appealId: crypto.randomUUID(), decisionId: hiddenId, justification: 'Erreur.' };
	expect((await post(request, '/api/appeals', 'appeal', appeal, reporter)).status()).toBe(403);
	expect((await post(request, '/api/appeals', 'appeal', appeal, author)).status()).toBe(201);
	// Un seul recours en cours par décision.
	const second = { ...appeal, appealId: crypto.randomUUID() };
	expect((await post(request, '/api/appeals', 'appeal', second, author)).status()).toBe(409);

	const listed = await post(
		request,
		'/api/referent/reports',
		'referent-access',
		{ requestedAt: Date.now() },
		referent
	);
	const { appeals } = (await listed.json()) as { appeals: { id: string }[] };
	expect(appeals.map((a) => a.id)).toContain(appeal.appealId);

	const restored = await post(
		request,
		'/api/decisions',
		'moderation-decision',
		decision({ appealId: appeal.appealId, textId: contested.textId, outcome: 'maintained' }),
		referent
	);
	expect(restored.status()).toBe(201);
	expect(await (await request.get(`/textes/${contested.textId}`)).text()).toContain('Contenu.');
	expect(await (await request.get('/journal')).text()).toContain('Recours');
});

test('signaleur peu fiable : ni masquage conservatoire ni jury', async ({ request }) => {
	const abuser = newKeys();
	await register(request, abuser, 'Abusif');
	await db`
		update pseudonym set created_on = created_on - ${JURY.immediateMaskReporterAgeDays + 1}::int
		where public_key = ${Buffer.from(abuser.publicKey)}`;
	// Cinq signalements classés sans suite.
	for (let i = 0; i < 5; i++) {
		const target = text(`Texte légal ${i}`);
		await post(request, '/api/texts', 'text-version', target, author);
		const reportId = crypto.randomUUID();
		await post(
			request,
			'/api/reports',
			'report',
			{
				reportId,
				textId: target.textId,
				version: 1,
				category: 'defamation-insult',
				passage: 'Contenu.',
				justification: 'Abusif.'
			},
			abuser
		);
		await post(
			request,
			'/api/decisions',
			'moderation-decision',
			decision({ reportId, textId: target.textId, category: 'defamation-insult' }),
			referent
		);
	}
	const target = text('Texte visé par un abus');
	await post(request, '/api/texts', 'text-version', target, author);
	const report = await post(
		request,
		'/api/reports',
		'report',
		{
			reportId: crypto.randomUUID(),
			textId: target.textId,
			version: 1,
			category: 'terrorism-apology',
			passage: 'Contenu.',
			justification: 'Abusif.'
		},
		abuser
	);
	expect(((await report.json()) as { route: string }).route).toBe('referent');
	expect(await (await request.get(`/textes/${target.textId}`)).text()).toContain('Contenu.');
});

test('codes d’invitation réservés au référent et à l’équipe ; application installable', async ({
	request
}) => {
	const ask = (keys: Keys) =>
		post(
			request,
			'/api/invitations',
			'invitation-create',
			{ count: 3, requestedAt: Date.now() },
			keys
		);
	expect((await ask(author)).status()).toBe(403);
	const created = await ask(referent);
	expect(created.status()).toBe(201);
	const { codes } = (await created.json()) as { codes: string[] };
	expect(codes).toHaveLength(3);
	expect(codes[0]).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

	const config = (await (await request.get('/api/pseudonyms')).json()) as {
		invitationRequired: boolean;
	};
	expect(config.invitationRequired).toBe(false);

	const manifest = await request.get('/manifest.webmanifest');
	expect(manifest.status()).toBe(200);
	expect(((await manifest.json()) as { name: string }).name).toBe('Maieutik');
	expect(await (await request.get('/')).text()).toContain('manifest.webmanifest');
});
