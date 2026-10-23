import { execFileSync } from 'node:child_process';

/** Applique les migrations (idempotentes) sur la base désignée par l'environnement. */
export default function globalSetup() {
	execFileSync(process.execPath, ['--env-file-if-exists=.env', 'scripts/migrate.ts'], {
		stdio: 'inherit'
	});
}
