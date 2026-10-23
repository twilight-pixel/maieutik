/**
 * Jury tiré au sort (niveau 2, docs/05, D03) : règles et tirage vérifiable.
 *
 * Tirage par engagement puis révélation :
 * 1. Pour chaque jour, le serveur tire une graine secrète et publie à l'avance son
 *    empreinte (engagement), avant de connaître les signalements de ce jour.
 * 2. Le tirage d'un jury combine la graine du jour, l'identifiant du signalement et la
 *    liste des jurés éligibles : chaque juré reçoit un score SHA-256, les plus petits sont retenus.
 * 3. Le lendemain, la graine est révélée : n'importe qui peut vérifier l'engagement et
 *    recalculer le tirage avec la liste des éligibles.
 *
 * Le serveur ne peut pas choisir la graine après coup (engagement publié), et le signaleur
 * ne la connaît pas : aucun des deux ne peut orienter la composition du jury.
 * Ce module est isomorphe : le même code sert au serveur et à toute vérification.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/** Seuils provisoires (docs/05, questions ouvertes) : à confirmer avant lancement. */
export const JURY = {
	/** Nombre de jurés tirés. */
	size: 9,
	/** Taille minimale du vivier d'éligibles pour qu'un jury soit tiré (sinon : référent). */
	minPool: 27,
	/** Ancienneté minimale d'un pseudonyme pour siéger, en jours. */
	minAgeDays: 90,
	/** Délai de vote, en jours. */
	deadlineDays: 7,
	/** Votes minimum pour conclure à l'échéance (sinon : renvoi au référent). */
	minVotes: 5,
	/** Part des votes exprimés concluant à l'illégalité pour masquer le texte. */
	illegalRatio: 2 / 3,
	/** Ancienneté minimale du signaleur pour un masquage conservatoire immédiat, en jours. */
	immediateMaskReporterAgeDays: 30
} as const;

/** Catégories manifestement illégales : masquage conservatoire immédiat, sans jury (docs/05). */
export const MANIFEST_CATEGORIES = ['child-abuse', 'terrorism-apology'] as const;

const hex = (input: string) => bytesToHex(sha256(utf8ToBytes(input)));

/** Engagement publié à l'avance pour une graine (hexadécimale). */
export function seedCommitment(seed: string): string {
	return hex(`maieutik/v1/jury-seed\n${seed}`);
}

/** Empreinte de la liste des éligibles (clés publiques base64url, triées). */
export function eligibleHash(keys: string[]): string {
	return hex(`maieutik/v1/jury-eligible\n${[...keys].sort().join('\n')}`);
}

function score(seed: string, reportId: string, key: string): string {
	return hex(`maieutik/v1/jury-draw\n${seed}\n${reportId}\n${key}`);
}

/** Tirage déterministe : les `size` éligibles au plus petit score. */
export function drawJurors(seed: string, reportId: string, eligible: string[], size: number) {
	return [...new Set(eligible)]
		.map((key) => ({ key, score: score(seed, reportId, key) }))
		.sort((a, b) => (a.score < b.score ? -1 : a.score > b.score ? 1 : 0))
		.slice(0, size)
		.map((entry) => entry.key);
}

/** Issue d'un jury à partir des votes exprimés. */
export function juryOutcome(
	votes: { illegal: number; legal: number },
	{ closing }: { closing: boolean }
): 'illegal' | 'legal' | 'pending' | 'escalated' {
	const cast = votes.illegal + votes.legal;
	const complete = cast >= JURY.size;
	if (!complete && !closing) return 'pending';
	if (cast < JURY.minVotes) return 'escalated';
	return votes.illegal / cast >= JURY.illegalRatio ? 'illegal' : 'legal';
}
