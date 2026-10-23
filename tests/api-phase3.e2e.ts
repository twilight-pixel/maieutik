/**
 * Phase 3 : jury tiré au sort (tirage vérifiable, vote à l'aveugle, clôture),
 * masquage conservatoire, rotation de clé, export intégral.
 */
import { expect, test, type APIRequestContext } from '@playwright/test';
import { createMnemonic, derivePseudonymKeypair, mnemonicToSeed } from '../src/lib/shared/identity';
import { encodeKey, sign, verify, type SignedEnvelope } from '../src/lib/shared/signature';
import { solveChallenge, type PowChallenge } from '../src/lib/shared/pow';
import { drawJurors, eligibleHash, JURY, seedCommitment } from '../src/lib/shared/jury';
import type { TextVersionPayload } from '../src/lib/shared/payloads';
import { testDatabase } from './db';

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

type Keys = ReturnType<typeof derivePseudonymKeypair>;
const newKeys = () => derivePseudonymKeypair(mnemonicToSeed(createMnemonic()));
const db = testDatabase();
test.afterAll(async () => {
	// Ne pas laisser de vivier de jurés aux autres tests (leurs signalements iraient en jury).
	await db`update pseudonym set jury_volunteer = false`;
	await db`delete from jury_pool where day >= utc_today()`;
	await db.end();
});

async function register(request: APIRequestContext, keys: Keys, displayName: string) {
	const challenge = (await (await request.get('/api/pow')).json()) as PowChallenge;
	const pow = await solveChallenge(challenge);
	const response = await request.post('/api/pseudonyms', {
		data: { envelope: sign('pseudonym', { displayName }, keys.secretKey), pow }
	});
	expect(response.status(), await response.text()).toBeLessThan(300);
}

/** Recule la date de création (test uniquement) pour atteindre l'ancienneté requise. */
async function age(keys: Keys, days: number) {
	await db`
		update pseudonym set created_on = created_on - ${days}::int
		where public_key = ${Buffer.from(keys.publicKey)}`;
}

function text(patch: Partial<TextVersionPayload> = {}): TextVersionPayload {
	return {
		textId: crypto.randomUUID(),
		version: 1,
		category: 'society/law',
		lang: 'fr',
		kind: 'opinion',
		title: 'Texte soumis au jury',
		body: {
			type: 'doc',
			content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Passage litigieux.' }] }]
		},
		tags: [],
		warnings: [],
		relation: null,
		question: null,
		sources: [],
		deferred: false,
		...patch
	};
}

const access = (keys: Keys) => ({
	data: { envelope: sign('jury-access', { requestedAt: Date.now() }, keys.secretKey) }
});

const author = newKeys();
const reporter = newKeys();
const volunteers = Array.from({ length: JURY.minPool }, newKeys);
const reported = text();

test('jury tiré au sort, vote à l’aveugle et décision publique', async ({ request }) => {
	// Base de test : on part d'un vivier vide pour savoir exactement qui peut être tiré.
	await db`update pseudonym set jury_volunteer = false`;
	await register(request, author, 'Auteur');
	await register(request, reporter, 'Signaleur');
	for (const [i, keys] of volunteers.entries()) {
		await register(request, keys, `Juré${i}`);
		await age(keys, JURY.minAgeDays + 1);
		const volunteered = await request.post('/api/jury/volunteer', {
			data: { envelope: sign('jury-volunteer', { available: true }, keys.secretKey) }
		});
		expect(volunteered.status()).toBe(200);
	}
	// Le vivier du jour est figé à l'avance (D16) : en base de test, on le fait recalculer
	// pour qu'il contienne les volontaires créés par ce test.
	await db`delete from jury_pool where day >= utc_today()`;

	expect(
		(
			await request.post('/api/texts', {
				data: { envelope: sign('text-version', reported, author.secretKey) }
			})
		).status()
	).toBe(201);

	const reportId = crypto.randomUUID();
	const report = await request.post('/api/reports', {
		data: {
			envelope: sign(
				'report',
				{
					reportId,
					textId: reported.textId,
					version: 1,
					category: 'defamation-insult',
					passage: 'Passage litigieux.',
					justification: 'Allégation diffamatoire.'
				},
				reporter.secretKey
			)
		}
	});
	expect(report.status()).toBe(201);
	expect(((await report.json()) as { route: string }).route).toBe('jury');

	// Chaque volontaire consulte ses missions : exactement neuf jurés tirés.
	const jurors: Keys[] = [];
	let juryId = '';
	for (const keys of volunteers) {
		const response = await request.post('/api/jury/assignments', access(keys));
		expect(response.status()).toBe(200);
		const { assignments } = (await response.json()) as {
			assignments: { juryId: string; textId: string }[];
		};
		const mine = assignments.find((a) => a.textId === reported.textId);
		if (mine) {
			jurors.push(keys);
			juryId = mine.juryId;
		}
	}
	expect(jurors).toHaveLength(JURY.size);

	// Un non-juré ne peut pas voter.
	const outsider = await request.post('/api/jury/votes', {
		data: {
			envelope: sign(
				'jury-vote',
				{ juryId, verdict: 'illegal', justification: 'Intrus.' },
				reporter.secretKey
			)
		}
	});
	expect(outsider.status()).toBe(403);

	// Six votes « illégal » sur neuf : deux tiers atteints à la clôture.
	for (const [i, keys] of jurors.entries()) {
		const verdict = i < 6 ? 'illegal' : 'legal';
		const vote = await request.post('/api/jury/votes', {
			data: {
				envelope: sign(
					'jury-vote',
					{ juryId, verdict, justification: `Vote ${i + 1}.` },
					keys.secretKey
				)
			}
		});
		expect(vote.status()).toBe(201);
	}

	expect(await (await request.get(`/textes/${reported.textId}`)).text()).toContain(
		'Texte masqué en attente d’examen'
	);
	const log = await (await request.get('/journal')).text();
	expect(log).toContain('Qualification par jury tiré au sort');
	expect(log).toContain('6 vote(s) pour l’illégalité, 3 contre');

	// Vérifiabilité : engagement publié, tirage recalculable une fois la graine révélée.
	const audit = await (await request.get('/jurys')).text();
	expect(audit).toContain(reportId.slice(0, 8));
	const [jury] = await db`
		select j.eligible_keys, j.eligible_hash, s.seed, s.commitment
		from jury j join jury_seed s on s.day = j.seed_day where j.id = ${juryId}`;
	expect(seedCommitment(jury.seed)).toBe(jury.commitment);
	expect(eligibleHash(jury.eligible_keys)).toBe(jury.eligible_hash);
	expect(drawJurors(jury.seed, reportId, jury.eligible_keys, JURY.size).sort()).toEqual(
		jurors.map((k) => encodeKey(k.publicKey)).sort()
	);
	expect(audit).toContain(jury.commitment);
	// La graine du jour n'est pas encore révélée.
	expect(audit).not.toContain(jury.seed);
});

test('masquage conservatoire d’un contenu manifestement illégal', async ({ request }) => {
	await age(reporter, JURY.immediateMaskReporterAgeDays + 1);
	const manifest = text({ title: 'Contenu manifestement illégal' });
	await request.post('/api/texts', {
		data: { envelope: sign('text-version', manifest, author.secretKey) }
	});
	const report = await request.post('/api/reports', {
		data: {
			envelope: sign(
				'report',
				{
					reportId: crypto.randomUUID(),
					textId: manifest.textId,
					version: 1,
					category: 'terrorism-apology',
					passage: 'Passage litigieux.',
					justification: 'Apologie.'
				},
				reporter.secretKey
			)
		}
	});
	expect(((await report.json()) as { route: string }).route).toBe('masked');
	expect(await (await request.get(`/textes/${manifest.textId}`)).text()).toContain(
		'Texte masqué en attente d’examen'
	);
});

test('rotation de clé : double signature, ancien pseudonyme déplacé, œuvre conservée', async ({
	request
}) => {
	const old = newKeys();
	const next = newKeys();
	await register(request, old, 'Hypatie');
	await register(request, next, 'Hypatie');
	const before = text({ title: 'Écrit avec l’ancienne clé' });
	await request.post('/api/texts', {
		data: { envelope: sign('text-version', before, old.secretKey) }
	});

	const move = { from: encodeKey(old.publicKey), to: encodeKey(next.publicKey) };
	// Sans acceptation de la nouvelle clé : refusé.
	const unaccepted = await request.post('/api/rotations', {
		data: { rotation: sign('key-rotation', move, old.secretKey) }
	});
	expect(unaccepted.status()).toBe(400);
	// Acceptation signée par une autre clé : refusée.
	const forged = await request.post('/api/rotations', {
		data: {
			rotation: sign('key-rotation', move, old.secretKey),
			acceptance: sign('key-rotation-accept', move, newKeys().secretKey)
		}
	});
	expect(forged.status()).toBe(400);

	const moved = await request.post('/api/rotations', {
		data: {
			rotation: sign('key-rotation', move, old.secretKey),
			acceptance: sign('key-rotation-accept', move, next.secretKey)
		}
	});
	expect(moved.status()).toBe(200);

	// L'ancienne clé ne peut plus publier ; la nouvelle reprend l'œuvre.
	const late = await request.post('/api/texts', {
		data: { envelope: sign('text-version', text(), old.secretKey) }
	});
	expect(late.status()).toBe(403);
	expect(await (await request.get(`/pseudonymes/${move.from}`)).text()).toContain('déplacé vers');
	expect(await (await request.get(`/pseudonymes/${move.to}`)).text()).toContain(
		'Écrit avec l’ancienne clé'
	);

	// Export : enveloppes signées vérifiables, rotation comprise.
	const exported = (await (await request.get(`/pseudonymes/${move.from}/export.json`)).json()) as {
		format: string;
		pseudonym: { rotation: { rotation: SignedEnvelope; acceptance: SignedEnvelope } };
		texts: { versions: { envelope: SignedEnvelope }[] }[];
	};
	expect(exported.format).toBe('maieutik-export/1');
	expect(verify(exported.pseudonym.rotation.rotation)).toBe(true);
	expect(verify(exported.pseudonym.rotation.acceptance)).toBe(true);
	expect(exported.texts.flatMap((t) => t.versions).every((v) => verify(v.envelope))).toBe(true);
});
