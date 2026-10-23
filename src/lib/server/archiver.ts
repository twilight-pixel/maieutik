import { readFileSync } from 'node:fs';
import { error } from '@sveltejs/kit';
import { ARCHIVER_TOKEN_FILE } from '$app/env/private';

/**
 * Jeton partagé avec le robot d'archivage (secret Docker). Sans jeton configuré,
 * l'interface interne n'existe pas (404). Caddy ne doit jamais exposer /internal/.
 */
const token = ARCHIVER_TOKEN_FILE ? readFileSync(ARCHIVER_TOKEN_FILE, 'utf-8').trim() : null;

export function requireArchiver(request: Request): void {
	const given = request.headers.get('authorization') ?? '';
	if (!token || !constantTimeEqual(given, `Bearer ${token}`)) error(404);
}

function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}
