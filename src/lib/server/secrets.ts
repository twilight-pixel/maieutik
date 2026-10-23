import { readFileSync } from 'node:fs';
import { SESSION_KEY_FILE } from '$app/env/private';

/**
 * Clé HMAC des preuves de travail. En production, lue dans un secret Docker pour que
 * les défis restent valides d'un redémarrage à l'autre ; sinon tirée au hasard.
 */
export const powKey: Uint8Array = SESSION_KEY_FILE
	? new TextEncoder().encode(readFileSync(SESSION_KEY_FILE, 'utf-8').trim())
	: crypto.getRandomValues(new Uint8Array(32));
