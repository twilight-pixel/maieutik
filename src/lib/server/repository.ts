/**
 * Accès aux données. Règles (CLAUDE.md) : aucune donnée de requête n'est stockée ;
 * dates au jour près ; versions en ajout seul ; un texte n'est visible qu'une fois
 * publié et sa date de publication atteinte (publication différée, D09).
 */
import type { TransactionSql } from 'postgres';
import { sql } from './db';
import { ApiError } from './api';
import { reporterStanding, routeReport } from './jury';
import { countLinks, plainText } from '#lib/shared/blocks.js';
import { intro, readingMinutes } from '#lib/shared/reading.js';
import { fingerprint } from '#lib/shared/identity.js';
import type { SignedEnvelope } from '#lib/shared/signature.js';
import type {
	AppealPayload,
	DecisionPayload,
	QuestionReportPayload,
	QuestionPayload,
	ReportPayload,
	Source,
	TextVersionPayload
} from '#lib/shared/payloads.js';
import type { ContentWarning, Lang, RelationKind, TextKind } from '#lib/shared/content.js';

const buf = (bytes: Uint8Array) => Buffer.from(bytes);
const keyOf = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');

export type TextStatus = 'published' | 'withdrawn_by_author' | 'under_review' | 'removed';

export type Author = { key: string; displayName: string; fingerprint: string; isTeam: boolean };

export type TextSummary = {
	id: string;
	category: string;
	lang: Lang;
	kind: TextKind;
	title: string | null;
	publishedOn: string;
	lastActivityOn: string;
	unsourced: boolean;
	replies: number;
	author: Author;
	/** Relation de ce texte avec celui qu'il discute (listes de réponses). */
	relationKind?: RelationKind;
	/** Début du texte (lignes de liste) ; `null` si le corps est retiré. */
	intro: string | null;
	/** Minutes de lecture estimées, `null` pour un texte court (src/lib/shared/reading.ts). */
	readMinutes: number | null;
	/** Nombre de sources déclarées : signal structurel, jamais un classement (docs/04 §7). */
	sources: number;
	/** Réfutations de ce texte restées sans réponse. */
	openRefutations: number;
};

// ---------------------------------------------------------------------------
// Pseudonymes

export async function getPseudonym(publicKey: Uint8Array) {
	const [row] = await sql`
		select p.display_name, p.fingerprint, p.created_on, p.is_team, p.moved_to,
			n.display_name as next_name, n.fingerprint as next_fingerprint
		from pseudonym p left join pseudonym n on n.public_key = p.moved_to
		where p.public_key = ${buf(publicKey)}`;
	if (!row) return null;
	const previous = await sql`
		with recursive chain(public_key, depth) as (
			select public_key, 1 from pseudonym where moved_to = ${buf(publicKey)}
			union all
			select p.public_key, c.depth + 1 from pseudonym p join chain c on p.moved_to = c.public_key
			where c.depth < 20
		)
		select p.public_key, p.display_name, p.fingerprint
		from chain c join pseudonym p on p.public_key = c.public_key order by c.depth`;
	return {
		key: keyOf(publicKey),
		displayName: row.display_name as string,
		fingerprint: row.fingerprint as string,
		createdOn: row.created_on as string,
		isTeam: row.is_team as boolean,
		moved: row.moved_to !== null,
		/** Nouvelle clé après rotation (docs/03). */
		movedTo: row.moved_to
			? {
					key: keyOf(row.moved_to as Buffer),
					displayName: row.next_name as string,
					fingerprint: row.next_fingerprint as string
				}
			: null,
		/** Anciennes clés de ce pseudonyme, de la plus récente à la plus ancienne. */
		previous: previous.map((p) => ({
			key: keyOf(p.public_key as Buffer),
			displayName: p.display_name as string,
			fingerprint: p.fingerprint as string
		}))
	};
}

/**
 * Rotation de clé (docs/03) : l'ancien pseudonyme est marqué « déplacé » vers le nouveau.
 * Les deux signatures (ancienne et nouvelle clé) portent sur le même contenu `{from, to}`.
 */
export async function rotateKey(
	from: Uint8Array,
	to: Uint8Array,
	rotation: SignedEnvelope,
	acceptance: SignedEnvelope
): Promise<void> {
	await sql.begin(async (tx) => {
		const rows = await tx`
			select public_key, moved_to from pseudonym
			where public_key in (${buf(from)}, ${buf(to)}) for update`;
		const old = rows.find((r) => buf(from).equals(r.public_key as Buffer));
		const next = rows.find((r) => buf(to).equals(r.public_key as Buffer));
		if (!old) throw new ApiError(404, 'Ancien pseudonyme inconnu');
		if (!next) throw new ApiError(404, 'Créez d’abord le nouveau pseudonyme');
		if (old.moved_to !== null) throw new ApiError(409, 'Ce pseudonyme a déjà été déplacé');
		if (next.moved_to !== null) throw new ApiError(409, 'Le nouveau pseudonyme a été déplacé');
		const [taken] = await tx`select 1 from pseudonym where moved_to = ${buf(to)}`;
		if (taken) throw new ApiError(409, 'Un autre pseudonyme a déjà été déplacé vers cette clé');
		await tx`
			update pseudonym set moved_to = ${buf(to)}, jury_volunteer = false,
				rotation = ${tx.json({ rotation, acceptance })}
			where public_key = ${buf(from)}`;
	});
}

export async function registerPseudonym(
	publicKey: Uint8Array,
	displayName: string,
	envelope: SignedEnvelope,
	{
		isTeam = false,
		invitationHash = null
	}: { isTeam?: boolean; invitationHash?: string | null } = {}
): Promise<'created' | 'exists'> {
	const existing = await getPseudonym(publicKey);
	if (existing) {
		if (existing.displayName !== displayName) {
			throw new ApiError(409, 'Ce pseudonyme existe déjà sous un autre nom');
		}
		return 'exists';
	}
	try {
		await sql.begin(async (tx) => {
			if (invitationHash) {
				// Le code est consommé ; rien ne le relie au pseudonyme créé.
				const [used] = await tx`
					update invitation set used_on = utc_today()
					where code_hash = ${invitationHash} and used_on is null returning 1`;
				if (!used) throw new ApiError(403, 'Code d’invitation invalide ou déjà utilisé');
			}
			await tx`
				insert into pseudonym (public_key, display_name, fingerprint, registration, is_team)
				values (${buf(publicKey)}, ${displayName}, ${fingerprint(publicKey)}, ${tx.json(envelope)},
					${isTeam})`;
		});
		return 'created';
	} catch (error) {
		if ((error as { code?: string }).code === '23505') {
			throw new ApiError(
				409,
				'Ce nom est déjà pris avec la même empreinte : choisissez-en un autre'
			);
		}
		throw error;
	}
}

async function requireAuthor(tx: TransactionSql, publicKey: Uint8Array) {
	const [row] = await tx`select moved_to from pseudonym where public_key = ${buf(publicKey)}`;
	if (!row) throw new ApiError(403, 'Pseudonyme inconnu : créez-le avant de publier');
	if (row.moved_to !== null) throw new ApiError(403, 'Ce pseudonyme a été déplacé');
}

// ---------------------------------------------------------------------------
// Publication

/** Décalage aléatoire de 1 à 3 jours pour la publication différée (D09). */
function deferredDays(): number {
	return 1 + (crypto.getRandomValues(new Uint32Array(1))[0] % 3);
}

export async function publishTextVersion(
	publicKey: Uint8Array,
	payload: TextVersionPayload,
	envelope: SignedEnvelope
): Promise<{ publishedOn: string; deferred: boolean }> {
	return sql.begin(async (tx) => {
		await requireAuthor(tx, publicKey);
		const [existing] = await tx`
			select author_key, category_id, lang, kind, status, published_on, question_id,
				(select max(version) from text_version where text_id = t.id) as last_version,
				(select json_build_object('kind', kind, 'target', target_id) from text_relation
					where source_id = t.id) as relation
			from text t where id = ${payload.textId} for update`;

		const unsourced =
			payload.kind === 'fact' && payload.sources.length === 0 && countLinks(payload.body) === 0;

		if (payload.version === 1) {
			if (existing) throw new ApiError(409, 'Ce texte existe déjà');
			if (payload.relation) {
				const [target] = await tx`
					select lang from text where id = ${payload.relation.target}
						and status = 'published' and published_on <= utc_today()`;
				if (!target) throw new ApiError(404, 'Le texte auquel vous répondez est introuvable');
				if (payload.relation.kind === 'translation-of' && target.lang === payload.lang) {
					throw new ApiError(400, 'Une traduction doit être dans une autre langue que l’original');
				}
			}
			if (payload.question) {
				const [question] = await tx`
					select 1 from question where id = ${payload.question} and status = 'published'`;
				if (!question) throw new ApiError(404, 'Question introuvable');
			}
			const offset = payload.deferred ? deferredDays() : 0;
			// Pour un texte différé, la date d'enregistrement est celle de publication :
			// la base ne garde aucune trace du jour réel de l'envoi.
			const [text] = await tx`
				insert into text (id, author_key, category_id, lang, kind, status, created_on, published_on,
					unsourced, question_id)
				values (${payload.textId}, ${buf(publicKey)}, ${payload.category}, ${payload.lang}, ${payload.kind},
					'published', utc_today() + ${offset}::int, utc_today() + ${offset}::int, ${unsourced},
					${payload.question})
				returning published_on`;
			if (payload.relation) {
				await tx`
					insert into text_relation (source_id, target_id, kind, created_on)
					values (${payload.textId}, ${payload.relation.target}, ${payload.relation.kind},
						${text.published_on})`;
			}
			await insertVersion(tx, payload, envelope, text.published_on as string);
			return { publishedOn: text.published_on as string, deferred: payload.deferred };
		}

		if (!existing) throw new ApiError(404, 'Texte introuvable');
		if (!Buffer.from(publicKey).equals(existing.author_key as Buffer)) {
			throw new ApiError(403, 'Seul l’auteur peut publier une nouvelle version');
		}
		if (existing.status !== 'published') throw new ApiError(409, 'Ce texte n’est plus modifiable');
		if (payload.version !== (existing.last_version as number) + 1) {
			throw new ApiError(409, 'Une version plus récente existe déjà : rechargez le texte');
		}
		const relation = existing.relation as { kind: string; target: string } | null;
		if (
			payload.category !== existing.category_id ||
			payload.lang !== existing.lang ||
			payload.kind !== existing.kind ||
			payload.question !== (existing.question_id ?? null) ||
			payload.relation?.kind !== relation?.kind ||
			payload.relation?.target !== relation?.target
		) {
			throw new ApiError(
				400,
				'Catégorie, langue, type, relation et question ne changent pas entre versions'
			);
		}
		await tx`update text set unsourced = ${unsourced} where id = ${payload.textId}`;
		const [today] = await tx`select greatest(utc_today(), ${existing.published_on}::date) as day`;
		await insertVersion(tx, payload, envelope, today.day as string);
		return { publishedOn: existing.published_on as string, deferred: false };
	});
}

async function insertVersion(
	tx: TransactionSql,
	payload: TextVersionPayload,
	envelope: SignedEnvelope,
	createdOn: string
) {
	await tx`
		insert into text_version (text_id, version, envelope, title, plain_text, created_on)
		values (${payload.textId}, ${payload.version}, ${tx.json(envelope)}, ${payload.title},
			${plainText(payload.body)}, ${createdOn})`;
	await tx`delete from text_tag where text_id = ${payload.textId}`;
	for (const tag of payload.tags) {
		await tx`insert into text_tag (text_id, tag) values (${payload.textId}, ${tag})`;
	} // Chaque adresse citée est mise en file pour le robot d'archivage (une fois par adresse).
	for (const source of payload.sources) {
		if (source.url) {
			await tx`insert into source_snapshot (url) values (${source.url}) on conflict (url) do nothing`;
		}
	}
}

/** Efface le corps de toutes les versions (retrait par l'auteur ou retrait légal). */
async function eraseBodies(tx: TransactionSql, textId: string) {
	await tx`
		update text_version set envelope = null, title = null, plain_text = null
		where text_id = ${textId} and envelope is not null`;
	await tx`delete from text_tag where text_id = ${textId}`;
}

export async function withdrawText(
	publicKey: Uint8Array,
	textId: string,
	envelope: SignedEnvelope
): Promise<void> {
	await sql.begin(async (tx) => {
		const [text] = await tx`select author_key, status from text where id = ${textId} for update`;
		if (!text) throw new ApiError(404, 'Texte introuvable');
		if (!Buffer.from(publicKey).equals(text.author_key as Buffer)) {
			throw new ApiError(403, 'Seul l’auteur peut retirer son texte');
		}
		if (text.status === 'withdrawn_by_author') return;
		if (text.status === 'removed') throw new ApiError(409, 'Ce texte a déjà été retiré');
		await tx`
			update text set status = 'withdrawn_by_author', withdrawal = ${tx.json(envelope)}
			where id = ${textId}`;
		await eraseBodies(tx, textId);
	});
}

// ---------------------------------------------------------------------------
// Signalements et décisions (docs/05)

export async function createReport(
	publicKey: Uint8Array,
	payload: ReportPayload,
	envelope: SignedEnvelope
): Promise<'masked' | 'jury' | 'referent' | 'duplicate'> {
	return sql.begin(async (tx) => {
		await requireAuthor(tx, publicKey);
		const [version] = await tx`
			select 1 from text_version v join text t on t.id = v.text_id
			where v.text_id = ${payload.textId} and v.version = ${payload.version}
				and t.status in ('published', 'under_review')`;
		if (!version) throw new ApiError(404, 'Texte ou version introuvable');
		const [dup] = await tx`select 1 from report where id = ${payload.reportId}`;
		if (dup) return 'duplicate';
		await tx`
			insert into report (id, text_id, version, reporter_key, legal_category, passage, justification, envelope)
			values (${payload.reportId}, ${payload.textId}, ${payload.version}, ${buf(publicKey)},
				${payload.category}, ${tx.json({ quote: payload.passage })}, ${payload.justification},
				${tx.json(envelope)})`;
		// Niveau suivant : masquage conservatoire, jury tiré au sort ou référent (docs/05).
		return routeReport(tx, {
			id: payload.reportId,
			textId: payload.textId,
			category: payload.category,
			reporterKey: publicKey
		});
	});
}

export async function createQuestionReport(
	publicKey: Uint8Array,
	payload: QuestionReportPayload,
	envelope: SignedEnvelope
): Promise<void> {
	await sql.begin(async (tx) => {
		await requireAuthor(tx, publicKey);
		const [question] = await tx`
			select title from question where id = ${payload.questionId} and status = 'published'`;
		if (!question) throw new ApiError(404, 'Question introuvable');
		const [dup] = await tx`select 1 from report where id = ${payload.reportId}`;
		if (dup) return;
		// Les questions vont toujours au référent : elles sont rares et visibles de tous.
		await tx`
			insert into report (id, question_id, reporter_key, legal_category, passage, justification, envelope)
			values (${payload.reportId}, ${payload.questionId}, ${buf(publicKey)}, ${payload.category},
				${tx.json({ quote: question.title as string })}, ${payload.justification},
				${tx.json(envelope)})`;
	});
}

export async function listOpenReports() {
	const rows = await sql`
		select r.id, r.text_id, r.question_id, r.version, r.legal_category, r.passage, r.justification,
			r.created_on, r.reporter_key, coalesce(v.title, q.title) as title,
			coalesce(t.status::text, q.status) as status
		from report r
		left join text t on t.id = r.text_id
		left join text_version v on v.text_id = r.text_id and v.version = r.version
		left join question q on q.id = r.question_id
		where r.status = 'open'
		order by r.created_on, r.id
		limit 200`;
	const standings = new Map<string, Awaited<ReturnType<typeof reporterStanding>>>();
	for (const row of rows) {
		const key = keyOf(row.reporter_key as Buffer);
		if (!standings.has(key)) standings.set(key, await reporterStanding(sql, row.reporter_key));
	}
	return rows.map((row) => ({
		id: row.id as string,
		textId: row.text_id as string | null,
		questionId: row.question_id as string | null,
		version: row.version as number | null,
		category: row.legal_category as string,
		passage: (row.passage as { quote: string }).quote,
		justification: row.justification as string,
		createdOn: row.created_on as string,
		title: row.title as string | null,
		status: row.status as string,
		/** Fiabilité du signaleur, sans révéler son identité au référent. */
		reporter: standings.get(keyOf(row.reporter_key as Buffer))!
	}));
}

// ---------------------------------------------------------------------------
// Recours (docs/05) : l'auteur conteste une décision visant son texte.

export async function createAppeal(
	publicKey: Uint8Array,
	payload: AppealPayload,
	envelope: SignedEnvelope
): Promise<void> {
	await sql.begin(async (tx) => {
		const [decision] = await tx`
			select d.outcome, t.author_key from moderation_decision d join text t on t.id = d.text_id
			where d.id = ${payload.decisionId}`;
		if (!decision) throw new ApiError(404, 'Décision introuvable');
		if (!buf(publicKey).equals(decision.author_key as Buffer)) {
			throw new ApiError(403, 'Seul l’auteur du texte peut former un recours');
		}
		if (decision.outcome === 'maintained') {
			throw new ApiError(400, 'Cette décision maintient le texte : rien à contester');
		}
		const [dup] = await tx`select 1 from appeal where id = ${payload.appealId}`;
		if (dup) return;
		const [open] = await tx`
			select 1 from appeal where decision_id = ${payload.decisionId} and status = 'open'`;
		if (open) throw new ApiError(409, 'Un recours est déjà en cours pour cette décision');
		await tx`
			insert into appeal (id, decision_id, author_key, justification, envelope)
			values (${payload.appealId}, ${payload.decisionId}, ${buf(publicKey)},
				${payload.justification}, ${tx.json(envelope)})`;
	});
}

export async function listOpenAppeals() {
	const rows = await sql`
		select a.id, a.decision_id, a.justification, a.created_on, d.text_id, d.outcome,
			d.legal_category, d.reasoning, d.origin, v.title
		from appeal a
		join moderation_decision d on d.id = a.decision_id
		left join lateral (
			select title from text_version where text_id = d.text_id order by version desc limit 1
		) v on true
		where a.status = 'open'
		order by a.created_on, a.id`;
	return rows.map((row) => ({
		id: row.id as string,
		decisionId: row.decision_id as string,
		textId: row.text_id as string,
		title: row.title as string | null,
		justification: row.justification as string,
		createdOn: row.created_on as string,
		decision: {
			outcome: row.outcome as DecisionPayload['outcome'],
			category: row.legal_category as string,
			reasoning: row.reasoning as string,
			origin: row.origin as string
		}
	}));
}

export async function applyDecision(
	referentKey: Uint8Array,
	payload: DecisionPayload,
	envelope: SignedEnvelope
): Promise<void> {
	await sql.begin(async (tx) => {
		const [dup] = await tx`select 1 from moderation_decision where id = ${payload.decisionId}`;
		if (dup) return;

		if (payload.reportId) {
			const [report] = await tx`
				select text_id, question_id from report where id = ${payload.reportId} for update`;
			if (
				!report ||
				(report.text_id ?? null) !== payload.textId ||
				(report.question_id ?? null) !== payload.questionId
			) {
				throw new ApiError(400, 'Le signalement ne concerne pas cette cible');
			}
			await tx`
				update report set status = ${payload.outcome === 'maintained' ? 'dismissed' : 'decided'}
				where id = ${payload.reportId}`;
		}
		if (payload.appealId) {
			const [appeal] = await tx`
				select d.text_id from appeal a join moderation_decision d on d.id = a.decision_id
				where a.id = ${payload.appealId} and a.status = 'open' for update of a`;
			if (!appeal || appeal.text_id !== payload.textId) {
				throw new ApiError(400, 'Le recours ne concerne pas ce texte');
			}
			await tx`update appeal set status = 'decided' where id = ${payload.appealId}`;
		}

		const origin = payload.appealId ? 'appeal' : payload.reportId ? 'referent' : 'authority';
		await tx`
			insert into moderation_decision
				(id, text_id, question_id, report_id, appeal_id, legal_category, legal_basis, reasoning,
				 outcome, origin, referent_key, envelope, warning)
			values (${payload.decisionId}, ${payload.textId}, ${payload.questionId}, ${payload.reportId},
				${payload.appealId}, ${payload.category}, ${payload.legalBasis}, ${payload.reasoning},
				${payload.outcome}, ${origin}, ${buf(referentKey)}, ${tx.json(envelope)},
				${payload.warning})`;

		if (payload.questionId) {
			const [question] = await tx`select 1 from question where id = ${payload.questionId}`;
			if (!question) throw new ApiError(404, 'Question introuvable');
			if (payload.outcome === 'removed') {
				// Les positions restent publiées : seul le nœud « question » disparaît.
				await tx`update question set status = 'removed' where id = ${payload.questionId}`;
			}
			return;
		}

		const textId = payload.textId!;
		const [text] = await tx`select status from text where id = ${textId} for update`;
		if (!text) throw new ApiError(404, 'Texte introuvable');
		switch (payload.outcome) {
			case 'hidden':
				await tx`update text set status = 'under_review' where id = ${textId}`;
				break;
			case 'removed':
				await tx`update text set status = 'removed' where id = ${textId}`;
				await eraseBodies(tx, textId);
				break;
			case 'warning_added':
				await tx`
					update text set moderation_warnings = array_append(moderation_warnings, ${payload.warning})
					where id = ${textId} and not (${payload.warning} = any (moderation_warnings))`;
				break;
			case 'maintained':
				// Un texte masqué en attente d'examen redevient visible.
				if (text.status === 'under_review') {
					await tx`update text set status = 'published' where id = ${textId}`;
				}
				break;
		}
	});
}

export async function listDecisions(limit = 100, offset = 0) {
	const rows = await sql`
		select d.id, d.text_id, d.question_id, d.legal_category, d.legal_basis, d.reasoning, d.outcome,
			d.origin, d.decided_on, d.warning
		from moderation_decision d
		order by d.decided_on desc, d.id
		limit ${limit} offset ${offset}`;
	return rows.map((row) => ({
		id: row.id as string,
		textId: row.text_id as string | null,
		questionId: row.question_id as string | null,
		category: row.legal_category as string,
		legalBasis: row.legal_basis as string,
		reasoning: row.reasoning as string,
		outcome: row.outcome as DecisionPayload['outcome'],
		origin: row.origin as string,
		decidedOn: row.decided_on as string,
		warning: row.warning as ContentWarning | null
	}));
}

// ---------------------------------------------------------------------------
// Lecture

const VISIBLE = sql`t.status = 'published' and t.published_on <= utc_today()`;

/**
 * Réfutation restée sans réponse : texte visible qui en réfute un autre et que
 * personne n'a encore discuté (aucune relation visible vers lui, hors traduction).
 */
const UNANSWERED = sql`
	not exists (
		select 1 from text_relation r2 join text s2 on s2.id = r2.source_id
		where r2.target_id = r.source_id and r2.kind <> 'translation-of'
			and s2.status = 'published' and s2.published_on <= utc_today()
	)`;

/** Un mot français fait en moyenne six caractères, espace comprise : assez pour un temps de lecture. */
const CHARS_PER_WORD = 6;

function toSummary(row: Record<string, unknown>): TextSummary {
	return {
		id: row.id as string,
		category: row.category_id as string,
		lang: row.lang as Lang,
		kind: row.kind as TextKind,
		title: row.title as string | null,
		publishedOn: row.published_on as string,
		lastActivityOn: (row.last_activity_on ?? row.published_on) as string,
		unsourced: row.unsourced as boolean,
		replies: Number(row.replies ?? 0),
		intro: intro(row.intro_src as string | null),
		readMinutes: readingMinutes(Math.round(Number(row.chars ?? 0) / CHARS_PER_WORD)),
		sources: Number(row.sources ?? 0),
		openRefutations: Number(row.open_refutations ?? 0),
		...(row.relation_kind ? { relationKind: row.relation_kind as RelationKind } : {}),
		author: {
			key: keyOf(row.author_key as Buffer),
			displayName: row.display_name as string,
			fingerprint: row.fingerprint as string,
			isTeam: row.is_team as boolean
		}
	};
}

const SUMMARY_COLUMNS = sql`
	t.id, t.category_id, t.lang, t.kind, t.published_on, t.unsourced, t.author_key,
	p.display_name, p.fingerprint, p.is_team, lv.title,
	coalesce(act.replies, 0) as replies,
	greatest(t.published_on, act.last_reply_on) as last_activity_on,
	lv.intro_src, lv.chars, lv.sources,
	(
		select count(*) from text_relation r join text s on s.id = r.source_id
		where r.target_id = t.id and r.kind = 'refutes'
			and s.status = 'published' and s.published_on <= utc_today() and ${UNANSWERED}
	) as open_refutations`;

const SUMMARY_JOINS = sql`
	join pseudonym p on p.public_key = t.author_key
	join lateral (
		select title, left(plain_text, 600) as intro_src, char_length(plain_text) as chars,
			case when jsonb_typeof(envelope->'payload'->'sources') = 'array'
				then jsonb_array_length(envelope->'payload'->'sources') else 0 end as sources
		from text_version where text_id = t.id order by version desc limit 1
	) lv on true
	left join lateral (
		select count(*) as replies, max(s.published_on) as last_reply_on
		from text_relation r join text s on s.id = r.source_id
		where r.target_id = t.id and r.kind <> 'translation-of'
			and s.status = 'published' and s.published_on <= utc_today()
	) act on true`;

export async function listTexts({
	category,
	sort = 'activity',
	limit = 30,
	offset = 0
}: {
	category?: string;
	sort?: 'activity' | 'recent';
	limit?: number;
	offset?: number;
}): Promise<TextSummary[]> {
	const inCategory = category
		? sql`and (t.category_id = ${category} or t.category_id like ${category + '/%'})`
		: sql``;
	const order =
		sort === 'recent'
			? sql`t.published_on desc, t.id`
			: sql`last_activity_on desc, t.published_on desc, t.id`;
	const rows = await sql`
		select ${SUMMARY_COLUMNS} from text t ${SUMMARY_JOINS}
		where ${VISIBLE} ${inCategory}
		order by ${order}
		limit ${limit} offset ${offset}`;
	return rows.map(toSummary);
}

/** Œuvre d'un pseudonyme : ses textes et ceux de ses anciennes clés (rotation). */
export async function listPseudonymTexts(
	publicKey: Uint8Array,
	{ limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}
): Promise<TextSummary[]> {
	const rows = await sql`
		with recursive chain(public_key, depth) as (
			select ${buf(publicKey)}::bytea, 0
			union all
			select p.public_key, c.depth + 1 from pseudonym p join chain c on p.moved_to = c.public_key
			where c.depth < 20
		)
		select ${SUMMARY_COLUMNS} from text t ${SUMMARY_JOINS}
		where ${VISIBLE} and t.author_key in (select public_key from chain)
		order by t.category_id, t.published_on desc, t.id
		limit ${limit} offset ${offset}`;
	return rows.map(toSummary);
}

/**
 * Export intégral et vérifiable d'un pseudonyme (docs/07, phase 3) : toutes les enveloppes
 * signées publiques. Les corps retirés ou masqués n'y figurent pas.
 */
export async function exportPseudonym(publicKey: Uint8Array) {
	const [pseudonym] = await sql`
		select display_name, fingerprint, created_on, registration, rotation, moved_to
		from pseudonym where public_key = ${buf(publicKey)}`;
	if (!pseudonym) return null;
	const texts = await sql`
		select t.id, t.status, t.published_on, t.withdrawal,
			coalesce(json_agg(json_build_object('version', v.version, 'createdOn', v.created_on,
				'envelope', case when t.status = 'under_review' then null else v.envelope end)
				order by v.version) filter (where v.version is not null), '[]') as versions
		from text t left join text_version v on v.text_id = t.id
		where t.author_key = ${buf(publicKey)} and t.published_on <= utc_today()
		group by t.id order by t.published_on, t.id`;
	const questions = await sql`
		select envelope from question where author_key = ${buf(publicKey)} and status = 'published'
		order by created_on, id`;
	return {
		format: 'maieutik-export/1',
		pseudonym: {
			key: keyOf(publicKey),
			displayName: pseudonym.display_name as string,
			fingerprint: pseudonym.fingerprint as string,
			createdOn: pseudonym.created_on as string,
			registration: pseudonym.registration as SignedEnvelope | null,
			rotation: pseudonym.rotation as {
				rotation: SignedEnvelope;
				acceptance: SignedEnvelope;
			} | null,
			movedTo: pseudonym.moved_to ? keyOf(pseudonym.moved_to as Buffer) : null
		},
		texts: texts.map((t) => ({
			id: t.id as string,
			status: t.status as TextStatus,
			publishedOn: t.published_on as string,
			withdrawal: t.withdrawal as SignedEnvelope | null,
			versions: t.versions as {
				version: number;
				createdOn: string;
				envelope: SignedEnvelope | null;
			}[]
		})),
		questions: questions.map((q) => q.envelope as SignedEnvelope)
	};
}

export type LinkedText = { id: string; title: string | null; lang: Lang; author: Author };
export type SourceView = Source & {
	snapshot: { status: string; archivedOn: string | null } | null;
};

export type TextView = {
	id: string;
	status: TextStatus;
	category: string;
	lang: Lang;
	kind: TextKind;
	publishedOn: string;
	unsourced: boolean;
	moderationWarnings: ContentWarning[];
	author: Author;
	version: number;
	versionOn: string | null;
	versions: { version: number; createdOn: string }[];
	/** Contenu signé de la version affichée ; null si le corps a été effacé. */
	payload: TextVersionPayload | null;
	envelope: SignedEnvelope | null;
	/** Relation de ce texte avec le texte qu'il discute. */
	relation: (LinkedText & { kind: RelationKind }) | null;
	/** Question de la discussion (rattachement direct ou hérité) ; `isPosition` si rattachement direct. */
	question: { id: string; title: string; isPosition: boolean } | null;
	/** Même texte dans d'autres langues (relation « traduction de »). */
	translations: LinkedText[];
	sources: SourceView[];
	replies: TextSummary[];
	repliesPage: number;
	hasMoreReplies: boolean;
	decisions: (Awaited<ReturnType<typeof listDecisions>>[number] & { appealed: boolean })[];
};

function toAuthor(row: Record<string, unknown>): Author {
	return {
		key: keyOf(row.author_key as Buffer),
		displayName: row.display_name as string,
		fingerprint: row.fingerprint as string,
		isTeam: row.is_team as boolean
	};
}

const LINKED_COLUMNS = sql`t.id, t.lang, lv.title, t.author_key, p.display_name, p.fingerprint, p.is_team`;
const LINKED_JOINS = sql`
	join pseudonym p on p.public_key = t.author_key
	join lateral (select title from text_version where text_id = t.id order by version desc limit 1) lv on true`;

function toLinked(row: Record<string, unknown>): LinkedText {
	return {
		id: row.id as string,
		title: row.title as string | null,
		lang: row.lang as Lang,
		author: toAuthor(row)
	};
}

/** Question de la discussion : celle du texte, ou celle de la position dont il descend. */
async function findQuestion(id: string) {
	const [row] = await sql`
		with recursive up(id, depth) as (
			select ${id}::uuid, 0
			union all
			select r.target_id, up.depth + 1
			from up join text_relation r on r.source_id = up.id and r.kind <> 'translation-of'
			where up.depth < 50
		)
		select q.id, q.title, up.depth
		from up join text t on t.id = up.id join question q on q.id = t.question_id
		where q.status = 'published'
		order by up.depth limit 1`;
	return row
		? { id: row.id as string, title: row.title as string, isPosition: row.depth === 0 }
		: null;
}

/** Texte et une de ses versions (la dernière par défaut). Null si introuvable ou pas encore publié. */
export const REPLIES_PAGE = 50;

/**
 * Texte et une de ses versions (la dernière par défaut). Null si introuvable ou pas encore publié.
 * Les réponses sont paginées par `REPLIES_PAGE` (`repliesPage` commence à 1).
 */
export async function getText(
	id: string,
	version?: number,
	{ repliesPage = 1 }: { repliesPage?: number } = {}
): Promise<TextView | null> {
	const [text] = await sql`
		select t.*, p.display_name, p.fingerprint, p.is_team
		from text t join pseudonym p on p.public_key = t.author_key
		where t.id = ${id} and t.published_on <= utc_today()`;
	if (!text) return null;

	const versions = await sql`
		select version, created_on, envelope from text_version where text_id = ${id} order by version`;
	const shown = version
		? versions.find((v) => v.version === version)
		: versions[versions.length - 1];
	if (!shown) return null;

	const [relation] = await sql`
		select r.kind, ${LINKED_COLUMNS}
		from text_relation r join text t on t.id = r.target_id ${LINKED_JOINS}
		where r.source_id = ${id}`;

	// Traductions : l'original et ses autres traductions, ou les traductions de ce texte.
	const original = relation?.kind === 'translation-of' ? (relation.id as string) : id;
	const translations = await sql`
		select ${LINKED_COLUMNS} from text t ${LINKED_JOINS}
		where ${VISIBLE} and t.id <> ${id} and (
			t.id = ${original}
			or t.id in (
				select source_id from text_relation where target_id = ${original} and kind = 'translation-of'
			)
		)
		order by t.lang, t.published_on`;

	const replies = await sql`
		select ${SUMMARY_COLUMNS}, rel.kind as relation_kind from text t ${SUMMARY_JOINS}
		join text_relation rel on rel.source_id = t.id and rel.kind <> 'translation-of'
		where rel.target_id = ${id} and ${VISIBLE}
		order by t.published_on, t.id
		limit ${REPLIES_PAGE + 1} offset ${(repliesPage - 1) * REPLIES_PAGE}`;

	const decisions = await sql`
		select d.id, d.text_id, d.legal_category, d.legal_basis, d.reasoning, d.outcome, d.origin,
			d.decided_on, d.warning,
			exists (select 1 from appeal a where a.decision_id = d.id and a.status = 'open') as appealed
		from moderation_decision d where d.text_id = ${id} order by d.decided_on, d.id`;

	const hidden = text.status === 'under_review';
	const envelope = hidden ? null : (shown.envelope as SignedEnvelope | null);
	const payload = (envelope?.payload as TextVersionPayload | undefined) ?? null;

	const urls = (payload?.sources ?? []).flatMap((source) => (source.url ? [source.url] : []));
	const snapshots = urls.length
		? await sql`select url, status, archived_on from source_snapshot where url in ${sql(urls)}`
		: [];

	return {
		id,
		status: text.status as TextStatus,
		category: text.category_id as string,
		lang: text.lang as Lang,
		kind: text.kind as TextKind,
		publishedOn: text.published_on as string,
		unsourced: text.unsourced as boolean,
		moderationWarnings: text.moderation_warnings as ContentWarning[],
		author: toAuthor(text),
		version: shown.version as number,
		versionOn: shown.created_on as string,
		versions: versions.map((v) => ({
			version: v.version as number,
			createdOn: v.created_on as string
		})),
		payload,
		envelope,
		relation: relation ? { ...toLinked(relation), kind: relation.kind as RelationKind } : null,
		question: await findQuestion(id),
		translations: translations.map(toLinked),
		sources: (payload?.sources ?? []).map((source) => {
			const snapshot = snapshots.find((row) => row.url === source.url);
			return {
				...source,
				snapshot: snapshot
					? {
							status: snapshot.status as string,
							archivedOn: snapshot.archived_on as string | null
						}
					: null
			};
		}),
		replies: replies.slice(0, REPLIES_PAGE).map(toSummary),
		repliesPage,
		hasMoreReplies: replies.length > REPLIES_PAGE,
		decisions: decisions.map((row) => ({
			id: row.id as string,
			textId: row.text_id as string | null,
			questionId: null,
			category: row.legal_category as string,
			legalBasis: row.legal_basis as string,
			reasoning: row.reasoning as string,
			outcome: row.outcome as DecisionPayload['outcome'],
			origin: row.origin as string,
			decidedOn: row.decided_on as string,
			warning: row.warning as ContentWarning | null,
			appealed: row.appealed as boolean
		}))
	};
}

export type SearchResult = TextSummary & { excerpt: string };

export async function searchTexts(
	query: string,
	{ lang, limit = 30, offset = 0 }: { lang?: Lang; limit?: number; offset?: number } = {}
): Promise<SearchResult[]> {
	const rows = await sql`
		with q as (
			select websearch_to_tsquery('french', ${query}) as fr, websearch_to_tsquery('english', ${query}) as en
		)
		select ${SUMMARY_COLUMNS},
			ts_rank(lv2.search, case t.lang when 'fr' then q.fr else q.en end) as rank,
			ts_headline(case t.lang when 'fr' then 'french' else 'english' end::regconfig,
				lv2.plain_text, case t.lang when 'fr' then q.fr else q.en end,
				'StartSel="", StopSel="", MaxWords=35, MinWords=15') as excerpt
		from q, text t ${SUMMARY_JOINS}
		join lateral (
			select search, plain_text from text_version where text_id = t.id order by version desc limit 1
		) lv2 on true
		where ${VISIBLE}
			and lv2.search @@ case t.lang when 'fr' then q.fr else q.en end
			${lang ? sql`and t.lang = ${lang}` : sql``}
		order by rank desc, t.published_on desc
		limit ${limit} offset ${offset}`;
	return rows.map((row) => ({ ...toSummary(row), excerpt: row.excerpt as string }));
}

// ---------------------------------------------------------------------------
// Questions et positions (docs/04 §4)

export type QuestionSummary = {
	id: string;
	title: string;
	category: string;
	lang: Lang;
	createdOn: string;
	positions: number;
	unansweredRefutations: number;
	author: Author;
};

export async function createQuestion(
	publicKey: Uint8Array,
	payload: QuestionPayload,
	envelope: SignedEnvelope
): Promise<'created' | 'exists'> {
	return sql.begin(async (tx) => {
		await requireAuthor(tx, publicKey);
		const [existing] = await tx`select author_key from question where id = ${payload.questionId}`;
		if (existing) {
			if (!Buffer.from(publicKey).equals(existing.author_key as Buffer)) {
				throw new ApiError(409, 'Cette question existe déjà');
			}
			return 'exists';
		}
		await tx`
			insert into question (id, author_key, title, category_id, lang, context, envelope)
			values (${payload.questionId}, ${buf(publicKey)}, ${payload.title}, ${payload.category},
				${payload.lang}, ${payload.context}, ${tx.json(envelope)})`;
		return 'created';
	});
}

/**
 * Tri des questions : récentes, « plus contradictoires » (nombre de positions en présence)
 * ou « sans réponse » (réfutations restées sans réponse). Jamais de popularité (docs/01).
 */
export type QuestionSort = 'recent' | 'contested' | 'unanswered';

export async function listQuestions({
	category,
	sort = 'recent',
	limit = 50,
	offset = 0
}: { category?: string; sort?: QuestionSort; limit?: number; offset?: number } = {}): Promise<
	QuestionSummary[]
> {
	const inCategory = category
		? sql`and (q.category_id = ${category} or q.category_id like ${category + '/%'})`
		: sql``;
	const rows = await sql`
		select q.id, q.title, q.category_id, q.lang, q.created_on, q.author_key,
			p.display_name, p.fingerprint, p.is_team,
			(select count(*) from text t where t.question_id = q.id and ${VISIBLE}) as positions,
			(select count(*) from text t
				join text_relation r on r.target_id = t.id and r.kind = 'refutes'
				join text s on s.id = r.source_id and s.status = 'published' and s.published_on <= utc_today()
				where t.question_id = q.id and ${VISIBLE} and ${UNANSWERED}) as unanswered
		from question q join pseudonym p on p.public_key = q.author_key
		where q.status = 'published' ${inCategory}
		order by ${
			sort === 'contested'
				? sql`positions desc, unanswered desc,`
				: sort === 'unanswered'
					? sql`unanswered desc, positions desc,`
					: sql``
		} q.created_on desc, q.id
		limit ${limit} offset ${offset}`;
	return rows.map((row) => ({
		id: row.id as string,
		title: row.title as string,
		category: row.category_id as string,
		lang: row.lang as Lang,
		createdOn: row.created_on as string,
		positions: Number(row.positions),
		unansweredRefutations: Number(row.unanswered),
		author: toAuthor(row)
	}));
}

/** Un texte du fil de discussion d'une position, avec les textes qui lui répondent. */
export type ThreadNode = TextSummary & { children: ThreadNode[] };

export type PositionView = TextSummary & {
	counts: Partial<Record<RelationKind, number>>;
	refutations: (TextSummary & { answered: boolean })[];
	/** Fil de discussion : réponses directes de la position, puis les réponses à ces réponses. */
	thread: ThreadNode[];
	/** Nombre de textes dans le fil (tous niveaux). */
	threadSize: number;
};

/** Profondeur et taille maximales du fil montré sur la page d'une question. */
const THREAD_MAX_DEPTH = 5;
const THREAD_MAX_NODES = 300;

/** Vue « positions en présence » : chaque position, ses soutiens et ses réfutations. */
export async function getQuestion(id: string) {
	const [question] = await sql`
		select q.*, p.display_name, p.fingerprint, p.is_team
		from question q join pseudonym p on p.public_key = q.author_key
		where q.id = ${id}`;
	if (!question) return null;

	const positions = await sql`
		select ${SUMMARY_COLUMNS} from text t ${SUMMARY_JOINS}
		where t.question_id = ${id} and ${VISIBLE}
		order by t.published_on, t.id`;
	const ids = positions.map((row) => row.id as string);

	const counts = ids.length
		? await sql`
			select r.target_id, r.kind, count(*) as n
			from text_relation r join text s on s.id = r.source_id
			where r.target_id in ${sql(ids)} and r.kind <> 'translation-of'
				and s.status = 'published' and s.published_on <= utc_today()
			group by r.target_id, r.kind`
		: [];

	const refutations = ids.length
		? await sql`
			select ${SUMMARY_COLUMNS}, r.target_id as position_id, ${UNANSWERED} as unanswered
			from text_relation r join text t on t.id = r.source_id ${SUMMARY_JOINS}
			where r.target_id in ${sql(ids)} and r.kind = 'refutes' and ${VISIBLE}
			order by t.published_on, t.id`
		: [];

	// Fil de discussion : tout ce qui répond, directement ou non, à une position (hors traductions).
	// Un texte retiré ou en examen coupe sa branche : ses réponses ne sont pas rattachées à autre chose.
	const thread = ids.length
		? await sql`
			with recursive thread (id, parent_id, kind, depth) as (
				select r.source_id, r.target_id, r.kind, 1
				from text_relation r
				where r.target_id in ${sql(ids)} and r.kind <> 'translation-of'
				union all
				select r.source_id, r.target_id, r.kind, th.depth + 1
				from thread th join text_relation r on r.target_id = th.id and r.kind <> 'translation-of'
				where th.depth < ${THREAD_MAX_DEPTH}
			)
			select ${SUMMARY_COLUMNS}, th.parent_id, th.kind as relation_kind
			from thread th join text t on t.id = th.id ${SUMMARY_JOINS}
			where ${VISIBLE}
			order by t.published_on, t.id
			limit ${THREAD_MAX_NODES}`
		: [];
	const nodes = new Map<string, ThreadNode>(
		thread.map((row) => [row.id as string, { ...toSummary(row), children: [] }])
	);
	const roots = new Map<string, ThreadNode[]>(ids.map((positionId) => [positionId, []]));
	for (const row of thread) {
		const node = nodes.get(row.id as string)!;
		const parent = row.parent_id as string;
		(roots.get(parent) ?? nodes.get(parent)?.children)?.push(node);
	}
	const sizeOf = (list: ThreadNode[]): number =>
		list.reduce((total, node) => total + 1 + sizeOf(node.children), 0);

	return {
		id: question.id as string,
		title: question.title as string,
		category: question.category_id as string,
		lang: question.lang as Lang,
		context: question.context as string,
		createdOn: question.created_on as string,
		status: question.status as 'published' | 'removed',
		author: toAuthor(question),
		positions: positions.map((row): PositionView => {
			const summary = toSummary(row);
			return {
				...summary,
				counts: Object.fromEntries(
					counts
						.filter((c) => c.target_id === summary.id)
						.map((c) => [c.kind as RelationKind, Number(c.n)])
				),
				refutations: refutations
					.filter((r) => r.position_id === summary.id)
					.map((r) => ({ ...toSummary(r), answered: !r.unanswered })),
				thread: roots.get(summary.id) ?? [],
				threadSize: sizeOf(roots.get(summary.id) ?? [])
			};
		})
	};
}

// ---------------------------------------------------------------------------
// Signaux de découverte (docs/04 §7) : règles publiques, jamais de popularité.

/** Réfutations restées sans réponse, les plus anciennes d'abord (elles attendent depuis le plus longtemps). */
export async function listUnansweredRefutations({
	category,
	limit = 30,
	offset = 0
}: { category?: string; limit?: number; offset?: number } = {}): Promise<
	(TextSummary & { target: LinkedText })[]
> {
	const inCategory = category
		? sql`and (t.category_id = ${category} or t.category_id like ${category + '/%'})`
		: sql``;
	const rows = await sql`
		select ${SUMMARY_COLUMNS}, r.target_id
		from text_relation r join text t on t.id = r.source_id ${SUMMARY_JOINS}
		where r.kind = 'refutes' and ${VISIBLE} and ${UNANSWERED} ${inCategory}
		order by t.published_on, t.id
		limit ${limit} offset ${offset}`;
	const targets = rows.length
		? await sql`
			select ${LINKED_COLUMNS} from text t ${LINKED_JOINS}
			where t.id in ${sql(rows.map((row) => row.target_id as string))}`
		: [];
	return rows.map((row) => ({
		...toSummary(row),
		target: toLinked(targets.find((target) => target.id === row.target_id)!)
	}));
}

// ---------------------------------------------------------------------------
// Archivage des sources (robot isolé, docs/08 « Points délicats »)

export const ARCHIVE_MAX_ATTEMPTS = 3;

/** Réserve des adresses à archiver ; chaque réservation compte comme une tentative. */
export async function claimArchiveJobs(limit = 10): Promise<string[]> {
	const rows = await sql`
		update source_snapshot set attempts = attempts + 1
		where url in (
			select url from source_snapshot
			where status = 'pending' and attempts < ${ARCHIVE_MAX_ATTEMPTS}
			order by requested_on, url
			limit ${limit}
			for update skip locked
		)
		returning url`;
	return rows.map((row) => row.url as string);
}

export type ArchiveResult =
	| {
			url: string;
			status: 'archived';
			contentType: string;
			sha256: string;
			title: string | null;
			text: string;
	  }
	| { url: string; status: 'failed' | 'refused' };

export async function saveArchiveResult(result: ArchiveResult): Promise<void> {
	if (result.status === 'archived') {
		await sql`
			update source_snapshot set status = 'archived', archived_on = utc_today(),
				content_type = ${result.contentType}, sha256 = ${result.sha256},
				title = ${result.title}, text_content = ${result.text}
			where url = ${result.url} and status = 'pending'`;
		return;
	}
	// Échec : nouvelle tentative plus tard, sauf refus définitif ou tentatives épuisées.
	await sql`
		update source_snapshot set status = case
			when ${result.status} = 'refused' or attempts >= ${ARCHIVE_MAX_ATTEMPTS} then ${result.status}
			else 'pending' end
		where url = ${result.url} and status = 'pending'`;
}

export async function getSnapshot(url: string) {
	const [row] = await sql`
		select url, status, archived_on, content_type, sha256, title, text_content
		from source_snapshot where url = ${url}`;
	return row
		? {
				url: row.url as string,
				status: row.status as string,
				archivedOn: row.archived_on as string | null,
				contentType: row.content_type as string | null,
				sha256: row.sha256 as string | null,
				title: row.title as string | null,
				text: row.text_content as string | null
			}
		: null;
}
