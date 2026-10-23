import { defineConfig } from '@playwright/test';

/**
 * Canari des écritures, lancé par la CI contre le serveur de production local
 * (`node build`), dont les journaux sont capturés. Pas de serveur de preview ici.
 */
export default defineConfig({
	testDir: '.',
	testMatch: '*.canary.ts',
	use: {
		baseURL: process.env.CANARY_BASE_URL ?? 'http://127.0.0.1:3000',
		// Job « image » : Caddy présente un certificat de son autorité interne pour localhost.
		ignoreHTTPSErrors: true
	}
});
