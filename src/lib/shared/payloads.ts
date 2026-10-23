/**
 * Contenus signés et leur validation stricte, partagée entre le navigateur
 * (avant signature) et le serveur (à la réception). Un contenu accepté par le serveur
 * doit être exactement celui que l'auteur a signé : aucune normalisation côté serveur.
 */
import { CONTENT_WARNINGS, LANGS, RELATION_KINDS, TAXONOMY, TEXT_KINDS } from './content';
import type { CategoryId, ContentWarning, Lang, RelationKind, TextKind } from './content';
import { isSafeHref, sourceRefs, validateDocument, type DocNode } from './blocks';

export type PseudonymPayload = { displayName: string };

export type TextVersionPayload = {
	textId: string;
	version: number;
	/** Catégorie ou sous-catégorie (`philosophy` ou `philosophy/ethics`). */
	category: string;
	lang: Lang;
	kind: TextKind;
	title: string;
	body: DocNode;
	tags: string[];
	warnings: ContentWarning[];
	/** Relation argumentative avec un autre texte (docs/04 §3), ou null. */
	relation: TextRelation | null;
	/** Question à laquelle ce texte apporte une position (docs/04 §4). Seulement sans relation. */
	question: string | null;
	/** Références structurées, citées dans le corps par la marque `sourceRef` (docs/04 §5). */
	sources: Source[];
	/** Publication différée avec décalage aléatoire (D09). */
	deferred: boolean;
};

export type TextRelation = { kind: RelationKind; target: string };

/** Référence structurée. `id` (`s1`, `s2`…) sert aux renvois dans le corps du texte. */
export type Source = {
	id: string;
	title: string;
	author: string | null;
	/** Année, mois ou jour : `2024`, `2024-05` ou `2024-05-17`. */
	date: string | null;
	publisher: string | null;
	url: string | null;
};

/** Question : nœud qui regroupe des positions contradictoires (docs/04 §4). */
export type QuestionPayload = {
	questionId: string;
	title: string;
	category: string;
	lang: Lang;
	/** Contexte facultatif, texte brut (chaîne vide si absent). */
	context: string;
};

export type WithdrawalPayload = { textId: string };

/** Catégories légales du signalement : liste fermée, provisoire (à valider avec l'avocat, docs/05). */
export const REPORT_CATEGORIES = [
	'hate-incitement',
	'defamation-insult',
	'terrorism-apology',
	'child-abuse',
	'harassment',
	'personal-data',
	'violence-incitement',
	'pornography',
	'spam',
	'copyright',
	'missing-warning',
	'other-illegal'
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export type ReportPayload = {
	reportId: string;
	textId: string;
	version: number;
	category: ReportCategory;
	/** Passage désigné, cité tel quel. */
	passage: string;
	justification: string;
};

export const DECISION_OUTCOMES = ['maintained', 'hidden', 'removed', 'warning_added'] as const;
export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];

/** Décision du référent juridique (niveau 3), motivée (DSA art. 17). */
export type DecisionPayload = {
	decisionId: string;
	reportId: string | null;
	/** Recours de l'auteur auquel la décision répond, le cas échéant. */
	appealId: string | null;
	/** Cible : un texte ou une question, exactement l'un des deux. */
	textId: string | null;
	questionId: string | null;
	category: ReportCategory;
	legalBasis: string;
	reasoning: string;
	outcome: DecisionOutcome;
	/** Avertissement ajouté quand l'issue est `warning_added`. */
	warning: ContentWarning | null;
};

export const TEXT_LIMITS = {
	displayName: 40,
	title: 200,
	tags: 8,
	tag: 40,
	passage: 1_000,
	justification: 2_000,
	legalBasis: 300,
	reasoning: 4_000,
	sources: 50,
	sourceField: 300,
	questionContext: 2_000
} as const;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** Vrai si la chaîne contient un caractère de contrôle (tabulation et retours compris). */
function hasControl(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if (code < 0x20 || code === 0x7f) return true;
	}
	return false;
}

export function isUuid(value: unknown): value is string {
	return typeof value === 'string' && UUID.test(value);
}

export function isCategory(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	const [category, sub, ...rest] = value.split('/');
	if (rest.length > 0 || !(category in TAXONOMY)) return false;
	return sub === undefined || (TAXONOMY[category as CategoryId] as readonly string[]).includes(sub);
}

function keys(value: unknown, expected: string[]): Record<string, unknown> | string {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return 'objet attendu';
	const actual = Object.keys(value).sort();
	const wanted = [...expected].sort();
	if (actual.join(',') !== wanted.join(',')) return `champs attendus : ${wanted.join(', ')}`;
	return value as Record<string, unknown>;
}

function line(value: unknown, max: number, field: string): string | null {
	if (typeof value !== 'string') return `${field} : texte attendu`;
	if (value.trim() !== value || value.length === 0) return `${field} : vide ou espaces en bord`;
	if (value.length > max) return `${field} : ${max} caractères au plus`;
	if (hasControl(value)) return `${field} : caractères de contrôle interdits`;
	return null;
}

function paragraph(value: unknown, max: number, field: string): string | null {
	if (typeof value !== 'string' || value.trim().length === 0) return `${field} : texte attendu`;
	if (value.length > max) return `${field} : ${max} caractères au plus`;
	return null;
}

function oneOf<T extends string>(value: unknown, list: readonly T[]): value is T {
	return typeof value === 'string' && (list as readonly string[]).includes(value);
}

export function validatePseudonym(value: unknown): Result<PseudonymPayload> {
	const fields = keys(value, ['displayName']);
	if (typeof fields === 'string') return { ok: false, error: fields };
	const error = line(fields.displayName, TEXT_LIMITS.displayName, 'nom');
	if (error) return { ok: false, error };
	if (/[#@/]/.test(fields.displayName as string)) {
		return { ok: false, error: 'nom : les caractères # @ / sont réservés' };
	}
	return { ok: true, value: value as PseudonymPayload };
}

export function validateTextVersion(value: unknown): Result<TextVersionPayload> {
	const fields = keys(value, [
		'textId',
		'version',
		'category',
		'lang',
		'kind',
		'title',
		'body',
		'tags',
		'warnings',
		'relation',
		'question',
		'sources',
		'deferred'
	]);
	if (typeof fields === 'string') return { ok: false, error: fields };
	const f = fields;
	const error =
		(!isUuid(f.textId) && 'identifiant de texte invalide') ||
		(!(
			Number.isInteger(f.version) &&
			(f.version as number) >= 1 &&
			(f.version as number) <= 10_000
		) &&
			'numéro de version invalide') ||
		(!isCategory(f.category) && 'catégorie inconnue') ||
		(!oneOf(f.lang, LANGS) && 'langue inconnue') ||
		(!oneOf(f.kind, TEXT_KINDS) && 'type de texte inconnu') ||
		line(f.title, TEXT_LIMITS.title, 'titre') ||
		validateTags(f.tags) ||
		validateWarnings(f.warnings) ||
		validateRelation(f.relation, f.textId) ||
		(f.question !== null && !isUuid(f.question) && 'question : identifiant invalide') ||
		(f.question !== null &&
			f.relation !== null &&
			'une position se rattache à une question, une réponse à un texte : pas les deux') ||
		(typeof f.deferred !== 'boolean' && 'publication différée : booléen attendu') ||
		validateDocument(f.body) ||
		validateSources(f.sources, f.body as DocNode);
	return error ? { ok: false, error } : { ok: true, value: value as TextVersionPayload };
}

function validateRelation(value: unknown, textId: unknown): string | null {
	if (value === null) return null;
	const fields = keys(value, ['kind', 'target']);
	if (typeof fields === 'string') return `relation : ${fields}`;
	if (!oneOf(fields.kind, RELATION_KINDS)) return 'relation : type inconnu';
	if (!isUuid(fields.target)) return 'relation : identifiant invalide';
	if (fields.target === textId) return 'un texte ne peut pas se répondre à lui-même';
	return null;
}

const SOURCE_DATE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;

function validateSources(value: unknown, body: DocNode): string | null {
	if (!Array.isArray(value) || value.length > TEXT_LIMITS.sources) {
		return `sources : ${TEXT_LIMITS.sources} au plus`;
	}
	const ids: string[] = [];
	for (const [i, item] of value.entries()) {
		const fields = keys(item, ['id', 'title', 'author', 'date', 'publisher', 'url']);
		if (typeof fields === 'string') return `source ${i + 1} : ${fields}`;
		if (fields.id !== `s${i + 1}`) return `source ${i + 1} : identifiant s${i + 1} attendu`;
		const optional = (field: string, label: string) =>
			fields[field] === null ? null : line(fields[field], TEXT_LIMITS.sourceField, label);
		const error =
			line(fields.title, TEXT_LIMITS.sourceField, `source ${i + 1}, titre`) ||
			optional('author', `source ${i + 1}, auteur`) ||
			optional('publisher', `source ${i + 1}, éditeur`) ||
			(fields.date !== null &&
				!(typeof fields.date === 'string' && SOURCE_DATE.test(fields.date)) &&
				`source ${i + 1} : date AAAA, AAAA-MM ou AAAA-MM-JJ attendue`) ||
			(fields.url !== null &&
				!(typeof fields.url === 'string' && isSafeHref(fields.url)) &&
				`source ${i + 1} : adresse http(s) attendue`);
		if (error) return error;
		ids.push(fields.id as string);
	}
	const unknown = sourceRefs(body).find((ref) => !ids.includes(ref));
	return unknown ? `renvoi vers une source inexistante (${unknown})` : null;
}

export function validateQuestion(value: unknown): Result<QuestionPayload> {
	const fields = keys(value, ['questionId', 'title', 'category', 'lang', 'context']);
	if (typeof fields === 'string') return { ok: false, error: fields };
	const f = fields;
	const error =
		(!isUuid(f.questionId) && 'identifiant de question invalide') ||
		line(f.title, TEXT_LIMITS.title, 'question') ||
		(!isCategory(f.category) && 'catégorie inconnue') ||
		(!oneOf(f.lang, LANGS) && 'langue inconnue') ||
		(typeof f.context !== 'string' && 'contexte : texte attendu') ||
		((f.context as string).trim() !== f.context && 'contexte : espaces en bord') ||
		((f.context as string).length > TEXT_LIMITS.questionContext &&
			`contexte : ${TEXT_LIMITS.questionContext} caractères au plus`);
	return error ? { ok: false, error } : { ok: true, value: value as QuestionPayload };
}

function validateTags(value: unknown): string | null {
	if (!Array.isArray(value) || value.length > TEXT_LIMITS.tags) {
		return `étiquettes : ${TEXT_LIMITS.tags} au plus`;
	}
	for (const tag of value) {
		const error = line(tag, TEXT_LIMITS.tag, 'étiquette');
		if (error) return error;
		if (tag !== tag.toLowerCase()) return 'étiquettes : minuscules attendues';
	}
	if (new Set(value).size !== value.length) return 'étiquettes en double';
	const sorted = [...value].sort();
	if (sorted.join('\n') !== value.join('\n')) return 'étiquettes : ordre alphabétique attendu';
	return null;
}

function validateWarnings(value: unknown): string | null {
	if (!Array.isArray(value)) return 'avertissements : liste attendue';
	if (!value.every((w) => oneOf(w, CONTENT_WARNINGS))) return 'avertissement inconnu';
	if (new Set(value).size !== value.length) return 'avertissements en double';
	const ordered = CONTENT_WARNINGS.filter((w) => value.includes(w));
	if (ordered.join(',') !== value.join(',')) return 'avertissements : ordre canonique attendu';
	return null;
}

export function validateWithdrawal(value: unknown): Result<WithdrawalPayload> {
	const fields = keys(value, ['textId']);
	if (typeof fields === 'string') return { ok: false, error: fields };
	if (!isUuid(fields.textId)) return { ok: false, error: 'identifiant de texte invalide' };
	return { ok: true, value: value as WithdrawalPayload };
}

export function validateReport(value: unknown): Result<ReportPayload> {
	const fields = keys(value, [
		'reportId',
		'textId',
		'version',
		'category',
		'passage',
		'justification'
	]);
	if (typeof fields === 'string') return { ok: false, error: fields };
	const f = fields;
	const error =
		(!isUuid(f.reportId) && 'identifiant de signalement invalide') ||
		(!isUuid(f.textId) && 'identifiant de texte invalide') ||
		(!(Number.isInteger(f.version) && (f.version as number) >= 1) && 'version invalide') ||
		(!oneOf(f.category, REPORT_CATEGORIES) && 'catégorie légale inconnue') ||
		paragraph(f.passage, TEXT_LIMITS.passage, 'passage') ||
		paragraph(f.justification, TEXT_LIMITS.justification, 'justification');
	return error ? { ok: false, error } : { ok: true, value: value as ReportPayload };
}

export function validateDecision(value: unknown): Result<DecisionPayload> {
	const fields = keys(value, [
		'decisionId',
		'reportId',
		'appealId',
		'textId',
		'questionId',
		'category',
		'legalBasis',
		'reasoning',
		'outcome',
		'warning'
	]);
	if (typeof fields === 'string') return { ok: false, error: fields };
	const f = fields;
	const error =
		(!isUuid(f.decisionId) && 'identifiant de décision invalide') ||
		(f.reportId !== null && !isUuid(f.reportId) && 'identifiant de signalement invalide') ||
		(f.appealId !== null && !isUuid(f.appealId) && 'identifiant de recours invalide') ||
		((f.textId === null) === (f.questionId === null) && 'cible : un texte ou une question') ||
		(f.textId !== null && !isUuid(f.textId) && 'identifiant de texte invalide') ||
		(f.questionId !== null && !isUuid(f.questionId) && 'identifiant de question invalide') ||
		(f.questionId !== null &&
			f.outcome !== 'maintained' &&
			f.outcome !== 'removed' &&
			'une question est maintenue ou retirée') ||
		(!oneOf(f.category, REPORT_CATEGORIES) && 'catégorie légale inconnue') ||
		line(f.legalBasis, TEXT_LIMITS.legalBasis, 'base légale') ||
		paragraph(f.reasoning, TEXT_LIMITS.reasoning, 'motivation') ||
		(!oneOf(f.outcome, DECISION_OUTCOMES) && 'issue inconnue') ||
		(f.outcome === 'warning_added'
			? !oneOf(f.warning, CONTENT_WARNINGS) && 'avertissement à ajouter manquant'
			: f.warning !== null && 'avertissement inattendu');
	return error ? { ok: false, error } : { ok: true, value: value as DecisionPayload };
}

/** Étiquettes saisies librement → forme canonique attendue par validateTextVersion. */
export function normalizeTags(input: string[]): string[] {
	const tags = input
		.map((tag) => tag.trim().toLowerCase().replace(/\s+/g, ' '))
		.filter((tag) => tag.length > 0 && tag.length <= TEXT_LIMITS.tag);
	return [...new Set(tags)].sort().slice(0, TEXT_LIMITS.tags);
}

export function normalizeWarnings(input: string[]): ContentWarning[] {
	return CONTENT_WARNINGS.filter((warning) => input.includes(warning));
}

// ---------------------------------------------------------------------------
// Phase 3 : rotation de clé et jury

/**
 * Rotation de clé (docs/03) : déclaration signée par l'ancienne clé (`key-rotation`) et
 * acceptation signée par la nouvelle (`key-rotation-accept`), sur le même contenu.
 * La double signature prouve que les deux clés sont détenues par la même personne.
 */
export type RotationPayload = { from: string; to: string };

/** Volontariat pour siéger dans les jurys (docs/05). */
export type JuryVolunteerPayload = { available: boolean };

export const JURY_VERDICTS = ['illegal', 'legal'] as const;
export type JuryVerdict = (typeof JURY_VERDICTS)[number];

/** Vote à l'aveugle d'un juré, motivé. */
export type JuryVotePayload = { juryId: string; verdict: JuryVerdict; justification: string };

const PUBLIC_KEY = /^[A-Za-z0-9_-]{43}$/;

export function validateRotation(value: unknown): Result<RotationPayload> {
	const fields = keys(value, ['from', 'to']);
	if (typeof fields === 'string') return { ok: false, error: fields };
	if (typeof fields.from !== 'string' || !PUBLIC_KEY.test(fields.from)) {
		return { ok: false, error: 'ancienne clé invalide' };
	}
	if (typeof fields.to !== 'string' || !PUBLIC_KEY.test(fields.to)) {
		return { ok: false, error: 'nouvelle clé invalide' };
	}
	if (fields.from === fields.to) return { ok: false, error: 'les deux clés sont identiques' };
	return { ok: true, value: value as RotationPayload };
}

export function validateJuryVolunteer(value: unknown): Result<JuryVolunteerPayload> {
	const fields = keys(value, ['available']);
	if (typeof fields === 'string') return { ok: false, error: fields };
	if (typeof fields.available !== 'boolean') return { ok: false, error: 'booléen attendu' };
	return { ok: true, value: value as JuryVolunteerPayload };
}

export function validateJuryVote(value: unknown): Result<JuryVotePayload> {
	const fields = keys(value, ['juryId', 'verdict', 'justification']);
	if (typeof fields === 'string') return { ok: false, error: fields };
	const error =
		(!isUuid(fields.juryId) && 'identifiant de jury invalide') ||
		(!oneOf(fields.verdict, JURY_VERDICTS) && 'verdict inconnu') ||
		paragraph(fields.justification, TEXT_LIMITS.justification, 'justification');
	return error ? { ok: false, error } : { ok: true, value: value as JuryVotePayload };
}

// ---------------------------------------------------------------------------
// Compléments de modération et de démarrage (D18)

/** Signalement d'une question (titre ou contexte illicite). */
export type QuestionReportPayload = {
	reportId: string;
	questionId: string;
	category: ReportCategory;
	justification: string;
};

/** Recours de l'auteur contre une décision visant son texte (docs/05, garde-fous). */
export type AppealPayload = { appealId: string; decisionId: string; justification: string };

/** Création de codes d'invitation par le référent ou l'équipe (docs/07). */
export type InvitationRequestPayload = { count: number; requestedAt: number };

export function validateQuestionReport(value: unknown): Result<QuestionReportPayload> {
	const fields = keys(value, ['reportId', 'questionId', 'category', 'justification']);
	if (typeof fields === 'string') return { ok: false, error: fields };
	const error =
		(!isUuid(fields.reportId) && 'identifiant de signalement invalide') ||
		(!isUuid(fields.questionId) && 'identifiant de question invalide') ||
		(!oneOf(fields.category, REPORT_CATEGORIES) && 'catégorie légale inconnue') ||
		(fields.category === 'missing-warning' && 'catégorie sans objet pour une question') ||
		paragraph(fields.justification, TEXT_LIMITS.justification, 'justification');
	return error ? { ok: false, error } : { ok: true, value: value as QuestionReportPayload };
}

export function validateAppeal(value: unknown): Result<AppealPayload> {
	const fields = keys(value, ['appealId', 'decisionId', 'justification']);
	if (typeof fields === 'string') return { ok: false, error: fields };
	const error =
		(!isUuid(fields.appealId) && 'identifiant de recours invalide') ||
		(!isUuid(fields.decisionId) && 'identifiant de décision invalide') ||
		paragraph(fields.justification, TEXT_LIMITS.justification, 'justification');
	return error ? { ok: false, error } : { ok: true, value: value as AppealPayload };
}

export function validateInvitationRequest(value: unknown): Result<InvitationRequestPayload> {
	const fields = keys(value, ['count', 'requestedAt']);
	if (typeof fields === 'string') return { ok: false, error: fields };
	if (
		!Number.isInteger(fields.count) ||
		(fields.count as number) < 1 ||
		(fields.count as number) > 50
	) {
		return { ok: false, error: 'entre 1 et 50 codes' };
	}
	if (typeof fields.requestedAt !== 'number') return { ok: false, error: 'horodatage attendu' };
	return { ok: true, value: value as InvitationRequestPayload };
}
