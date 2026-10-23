/**
 * Jury tiré au sort (niveau 2, docs/05, D16) : aiguillage des signalements, tirage
 * vérifiable, votes à l'aveugle, clôture.
 *
 * - Catégories manifestement illégales, signaleur ancien : masquage conservatoire immédiat,
 *   puis référent (pas de jury, pour ne pas exposer des bénévoles).
 * - Sinon, si le vivier de volontaires éligibles est suffisant : tirage d'un jury.
 * - Sinon : le référent traite le signalement (démarrage, docs/05).
 */
import type { Sql, TransactionSql } from 'postgres';
import { sql } from './db';
import { ApiError } from './api';
import {
	drawJurors,
	eligibleHash,
	JURY,
	juryOutcome,
	MANIFEST_CATEGORIES,
	seedCommitment
} from '#lib/shared/jury.js';
import type { JuryVotePayload, ReportCategory } from '#lib/shared/payloads.js';
import type { SignedEnvelope } from '#lib/shared/signature.js';

type Tx = TransactionSql | Sql;

const buf = (bytes: Uint8Array) => Buffer.from(bytes);
const keyOf = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');

/** Graines du jour et des deux jours suivants, engagées à l'avance. */
async function ensureSeeds(tx: Tx): Promise<void> {
	const days = await tx`
		select d::date as day from generate_series(utc_today(), utc_today() + 2, interval '1 day') d
		where not exists (select 1 from jury_seed where day = d::date)`;
	for (const { day } of days) {
		const seed = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
		await tx`
			insert into jury_seed (day, commitment, seed)
			values (${day}, ${seedCommitment(seed)}, ${seed}) on conflict (day) do nothing`;
	}
}

/**
 * Vivier du jour, figé et publié à l'avance (D16, limite connue) : la liste des volontaires
 * éligibles d'un jour est arrêtée la veille. Un volontaire ajouté après coup ne peut pas
 * être tiré ce jour-là ; l'empreinte publiée permet de le vérifier.
 */
async function ensurePools(tx: Tx): Promise<void> {
	const days = await tx`
		select d::date as day from generate_series(utc_today(), utc_today() + 1, interval '1 day') d
		where not exists (select 1 from jury_pool where day = d::date)`;
	for (const { day } of days) {
		const rows = await tx`
			select public_key from pseudonym
			where jury_volunteer and moved_to is null
				and created_on <= ${day}::date - ${JURY.minAgeDays}::int`;
		const keys = rows.map((row) => keyOf(row.public_key as Buffer)).sort();
		await tx`
			insert into jury_pool (day, keys, hash) values (${day}, ${keys}, ${eligibleHash(keys)})
			on conflict (day) do nothing`;
	}
}

/**
 * Fiabilité d'un signaleur (docs/05, garde-fous) : part de ses signalements classés sans suite.
 * Un signaleur peu fiable ne déclenche ni jury ni masquage conservatoire : le référent tranche.
 */
export const REPORTER_STANDING = { minReports: 5, maxDismissedRatio: 0.8 } as const;

export async function reporterStanding(tx: Tx, reporterKey: Uint8Array) {
	const [row] = await tx`
		select count(*) filter (where status in ('decided', 'dismissed')) as closed,
			count(*) filter (where status = 'dismissed') as dismissed
		from report where reporter_key = ${buf(reporterKey)}`;
	const closed = Number(row.closed);
	const dismissed = Number(row.dismissed);
	return {
		closed,
		dismissed,
		reliable:
			closed < REPORTER_STANDING.minReports ||
			dismissed / closed < REPORTER_STANDING.maxDismissedRatio
	};
}

/** Aiguille un nouveau signalement (appelé dans la transaction qui l'enregistre). */
export async function routeReport(
	tx: TransactionSql,
	report: { id: string; textId: string; category: ReportCategory; reporterKey: Uint8Array }
): Promise<'masked' | 'jury' | 'referent'> {
	if (!(await reporterStanding(tx, report.reporterKey)).reliable) return 'referent';
	// Avertissement manquant : pas une question de légalité, traitement léger par le référent (docs/06).
	if (report.category === 'missing-warning') return 'referent';

	if ((MANIFEST_CATEGORIES as readonly string[]).includes(report.category)) {
		const [reporter] = await tx`
			select created_on <= utc_today() - ${JURY.immediateMaskReporterAgeDays}::int as senior
			from pseudonym where public_key = ${buf(report.reporterKey)}`;
		if (reporter?.senior) {
			const [masked] = await tx`
				update text set status = 'under_review'
				where id = ${report.textId} and status = 'published' returning id`;
			if (masked) {
				await tx`
					insert into moderation_decision
						(text_id, report_id, legal_category, legal_basis, reasoning, outcome, origin)
					values (${report.textId}, ${report.id}, ${report.category},
						'Masquage conservatoire (docs/05)',
						'Contenu signalé comme manifestement illégal : masqué en attente de l’examen du référent juridique.',
						'hidden', 'report')`;
			}
			return 'masked';
		}
		return 'referent';
	}

	await ensureSeeds(tx);
	await ensurePools(tx);
	// Vivier figé du jour, moins les retraits et les personnes liées à l'affaire.
	const [pool] = await tx`select keys from jury_pool where day = utc_today()`;
	const poolKeys = (pool.keys as string[]).map((key) => Buffer.from(key, 'base64url'));
	if (poolKeys.length < JURY.minPool) return 'referent';
	const eligible = await tx`
		select p.public_key from pseudonym p
		where p.public_key in ${tx(poolKeys)}
			and p.jury_volunteer and p.moved_to is null
			and p.public_key <> ${buf(report.reporterKey)}
			and p.public_key <> (select author_key from text where id = ${report.textId})
			and not exists (
				select 1 from text_relation r join text s on s.id = r.source_id
				where r.target_id = ${report.textId} and s.author_key = p.public_key
			)`;
	const keys = eligible.map((row) => keyOf(row.public_key as Buffer));
	if (keys.length < JURY.minPool) return 'referent';

	const [seed] = await tx`select seed, day from jury_seed where day = utc_today()`;
	const jurors = drawJurors(seed.seed as string, report.id, keys, JURY.size);
	const [jury] = await tx`
		insert into jury (report_id, text_id, seed_day, eligible_count, eligible_hash, eligible_keys, deadline)
		values (${report.id}, ${report.textId}, ${seed.day}, ${keys.length}, ${eligibleHash(keys)},
			${[...keys].sort()}, utc_today() + ${JURY.deadlineDays}::int)
		returning id`;
	for (const juror of jurors) {
		await tx`
			insert into jury_member (jury_id, juror_key)
			values (${jury.id}, ${Buffer.from(juror, 'base64url')})`;
	}
	await tx`update report set status = 'jury' where id = ${report.id}`;
	return 'jury';
}

/** Clôt un jury : décision publique motivée selon l'issue (docs/05). */
async function closeJury(tx: TransactionSql, juryId: string, closing: boolean): Promise<void> {
	const [jury] = await tx`
		select j.*, r.legal_category from jury j join report r on r.id = j.report_id
		where j.id = ${juryId} and j.status = 'open' for update of j`;
	if (!jury) return;
	const [counts] = await tx`
		select count(*) filter (where verdict = 'illegal') as illegal,
			count(*) filter (where verdict = 'legal') as legal
		from jury_vote where jury_id = ${juryId}`;
	const votes = { illegal: Number(counts.illegal), legal: Number(counts.legal) };
	const outcome = juryOutcome(votes, { closing });
	if (outcome === 'pending') return;

	if (outcome === 'escalated') {
		await tx`
			update jury set status = 'escalated', votes_illegal = ${votes.illegal},
				votes_legal = ${votes.legal}, closed_on = utc_today()
			where id = ${juryId}`;
		await tx`update report set status = 'open' where id = ${jury.report_id}`;
		return;
	}

	const tally = `${votes.illegal} vote(s) pour l’illégalité, ${votes.legal} contre`;
	if (outcome === 'illegal') {
		await tx`update text set status = 'under_review' where id = ${jury.text_id} and status = 'published'`;
	}
	await tx`
		insert into moderation_decision
			(text_id, report_id, legal_category, legal_basis, reasoning, outcome, origin)
		values (${jury.text_id}, ${jury.report_id}, ${jury.legal_category},
			'Qualification par jury tiré au sort (docs/05)',
			${
				outcome === 'illegal'
					? `Majorité des deux tiers atteinte (${tally}) : texte masqué en attente du référent juridique.`
					: `Majorité des deux tiers non atteinte (${tally}) : texte maintenu.`
			},
			${outcome === 'illegal' ? 'hidden' : 'maintained'}, 'jury')`;
	await tx`
		update jury set status = 'decided', outcome = ${outcome}, votes_illegal = ${votes.illegal},
			votes_legal = ${votes.legal}, closed_on = utc_today()
		where id = ${juryId}`;
	await tx`
		update report set status = ${outcome === 'illegal' ? 'decided' : 'dismissed'}
		where id = ${jury.report_id}`;
}

/** Clôt les jurys arrivés à échéance. Appelé paresseusement : aucune tâche planifiée. */
export async function closeDueJuries(): Promise<void> {
	const due = await sql`select id from jury where status = 'open' and deadline < utc_today()`;
	for (const { id } of due) {
		await sql.begin((tx) => closeJury(tx, id as string, true));
	}
}

export async function setVolunteer(publicKey: Uint8Array, available: boolean): Promise<void> {
	const [row] = await sql`
		update pseudonym set jury_volunteer = ${available}
		where public_key = ${buf(publicKey)} and moved_to is null returning 1`;
	if (!row) throw new ApiError(403, 'Pseudonyme inconnu ou déplacé');
}

export async function getJurorStatus(publicKey: Uint8Array) {
	const [row] = await sql`
		select jury_volunteer, created_on <= utc_today() - ${JURY.minAgeDays}::int as senior,
			created_on + ${JURY.minAgeDays}::int as eligible_on
		from pseudonym where public_key = ${buf(publicKey)}`;
	return row
		? {
				volunteer: row.jury_volunteer as boolean,
				senior: row.senior as boolean,
				eligibleOn: row.eligible_on as string
			}
		: null;
}

/** Jurys en attente du vote de ce juré, avec le passage et la version signalés. */
export async function listAssignments(publicKey: Uint8Array) {
	await closeDueJuries();
	const rows = await sql`
		select j.id, j.deadline, r.legal_category, r.passage, r.justification, r.version, j.text_id,
			v.envelope
		from jury_member m
		join jury j on j.id = m.jury_id and j.status = 'open'
		join report r on r.id = j.report_id
		left join text_version v on v.text_id = j.text_id and v.version = r.version
		where m.juror_key = ${buf(publicKey)}
			and not exists (
				select 1 from jury_vote vote where vote.jury_id = j.id and vote.juror_key = m.juror_key
			)
		order by j.deadline, j.id`;
	return rows.map((row) => ({
		juryId: row.id as string,
		deadline: row.deadline as string,
		category: row.legal_category as ReportCategory,
		passage: (row.passage as { quote: string }).quote,
		justification: row.justification as string,
		textId: row.text_id as string,
		version: row.version as number,
		// Corps de la version signalée (null s'il a été effacé entre-temps).
		payload: ((row.envelope as SignedEnvelope | null)?.payload ?? null) as unknown
	}));
}

export async function castVote(
	publicKey: Uint8Array,
	payload: JuryVotePayload,
	envelope: SignedEnvelope
): Promise<void> {
	await sql.begin(async (tx) => {
		const [member] = await tx`
			select j.status from jury_member m join jury j on j.id = m.jury_id
			where m.jury_id = ${payload.juryId} and m.juror_key = ${buf(publicKey)}
			for update of j`;
		if (!member) throw new ApiError(403, 'Vous ne siégez pas dans ce jury');
		if (member.status !== 'open') throw new ApiError(409, 'Ce jury est clos');
		const [done] = await tx`
			select 1 from jury_vote where jury_id = ${payload.juryId} and juror_key = ${buf(publicKey)}`;
		if (done) throw new ApiError(409, 'Vous avez déjà voté');
		await tx`
			insert into jury_vote (jury_id, juror_key, verdict, justification, envelope)
			values (${payload.juryId}, ${buf(publicKey)}, ${payload.verdict}, ${payload.justification},
				${tx.json(envelope)})`;
		await closeJury(tx, payload.juryId, false);
	});
}

/** Données publiques de vérification : engagements, graines révélées, jurys. */
export async function getJuryAudit() {
	await closeDueJuries();
	await ensureSeeds(sql);
	await ensurePools(sql);
	const seeds = await sql`
		select s.day, s.commitment, case when s.day < utc_today() then s.seed end as seed,
			p.hash as pool_hash, cardinality(p.keys) as pool_size
		from jury_seed s left join jury_pool p on p.day = s.day
		where s.day >= utc_today() - 60
		order by s.day desc`;
	const juries = await sql`
		select j.id, j.created_on, j.seed_day, j.eligible_count, j.eligible_hash, j.status, j.outcome,
			j.votes_illegal, j.votes_legal, j.closed_on, r.id as report_id, r.legal_category,
			case when j.status <> 'open' then j.text_id end as text_id
		from jury j join report r on r.id = j.report_id
		order by j.created_on desc, j.id
		limit 200`;
	return {
		seeds: seeds.map((row) => ({
			day: row.day as string,
			commitment: row.commitment as string,
			seed: row.seed as string | null,
			poolHash: row.pool_hash as string | null,
			poolSize: row.pool_size as number | null
		})),
		juries: juries.map((row) => ({
			id: row.id as string,
			reportId: row.report_id as string,
			createdOn: row.created_on as string,
			seedDay: row.seed_day as string,
			eligibleCount: row.eligible_count as number,
			eligibleHash: row.eligible_hash as string,
			status: row.status as 'open' | 'decided' | 'escalated',
			outcome: row.outcome as 'illegal' | 'legal' | null,
			votesIllegal: row.votes_illegal as number | null,
			votesLegal: row.votes_legal as number | null,
			closedOn: row.closed_on as string | null,
			category: row.legal_category as ReportCategory,
			textId: row.text_id as string | null
		}))
	};
}
