import { defineConfig } from '@playwright/test';
import { archiverTokenFile, REFERENT_KEY } from './tests/fixtures';

export default defineConfig({
	// La base vient de l'environnement (DATABASE_URL ou PG*, ou .env en local) : rien n'est codé ici.
	globalSetup: './tests/global-setup.ts',
	webServer: {
		command: 'pnpm build && pnpm preview',
		port: 4173,
		// Build de production compris (environ 40 s en local).
		timeout: 180_000,
		env: { REFERENT_KEYS: REFERENT_KEY, ARCHIVER_TOKEN_FILE: archiverTokenFile() }
	},
	testMatch: '**/*.e2e.{ts,js}'
});
