/**
 * Codes d'invitation facultatifs (démarrage à froid, docs/07). Seule l'empreinte SHA-256 du
 * code est conservée ; le code est consommé à la création d'un pseudonyme sans y être relié.
 */
import { createHash, randomBytes } from 'node:crypto';
import { INVITATIONS_REQUIRED } from '$app/env/private';
import { sql } from './db';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const invitationsRequired = (): boolean => INVITATIONS_REQUIRED;

export function invitationHash(code: string): string {
	const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
	return createHash('sha256').update(`maieutik/v1/invitation\n${clean}`).digest('hex');
}

/** Crée `count` codes et ne renvoie qu'une fois leur valeur en clair. */
export async function createInvitations(count: number): Promise<string[]> {
	const codes = Array.from({ length: count }, () => {
		const chars = [...randomBytes(12)].map((b) => ALPHABET[b % ALPHABET.length]).join('');
		return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
	});
	for (const code of codes) {
		await sql`insert into invitation (code_hash) values (${invitationHash(code)})`;
	}
	return codes;
}
