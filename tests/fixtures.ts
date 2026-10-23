/**
 * Identités et secrets de test. Ne servent qu'aux tests e2e : la clé du référent et le
 * jeton du robot d'archivage sont passés au serveur de test par playwright.config.ts.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { derivePseudonymKeypair, mnemonicToSeed } from '../src/lib/shared/identity';
import { encodeKey } from '../src/lib/shared/signature';

export const REFERENT_MNEMONIC =
	'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

export const referent = derivePseudonymKeypair(mnemonicToSeed(REFERENT_MNEMONIC));
export const REFERENT_KEY = encodeKey(referent.publicKey);

/** Jeton du robot d'archivage, écrit dans un fichier comme le serait un secret Docker. */
export const ARCHIVER_TOKEN = 'jeton-de-test-du-robot-archiveur';
export function archiverTokenFile(): string {
	// Hors de test-results/, que Playwright vide au démarrage.
	const dir = join(tmpdir(), 'maieutik-e2e-secrets');
	mkdirSync(dir, { recursive: true });
	const file = join(dir, 'archiver_token');
	writeFileSync(file, ARCHIVER_TOKEN);
	return file;
}
