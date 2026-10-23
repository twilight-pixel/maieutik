/**
 * Paramètres de connexion Postgres, partagés par l'application et scripts/migrate.ts.
 *
 * Deux modes :
 * - DATABASE_URL (développement) ;
 * - variables PG* standard + DATABASE_PASSWORD_FILE (production, secret Docker ; deploy/compose.yaml).
 */
import { readFileSync } from 'node:fs';
import type { Options, PostgresType } from 'postgres';

export const DEV_DATABASE_URL = 'postgres://maieutik:maieutik@localhost:5432/maieutik';

type Env = Record<string, string | undefined>;

export function databaseConnection(env: Env): {
	url: string | undefined;
	options: Options<Record<string, PostgresType>>;
} {
	const passwordFile = env.DATABASE_PASSWORD_FILE;
	const usePgVariables = !env.DATABASE_URL && Boolean(env.PGHOST);
	return {
		url: usePgVariables ? undefined : env.DATABASE_URL || DEV_DATABASE_URL,
		options: {
			onnotice: () => {},
			...(passwordFile ? { password: readFileSync(passwordFile, 'utf-8').trim() } : {}),
			// Les dates publiques sont au jour près : les colonnes DATE restent des chaînes AAAA-MM-JJ.
			types: {
				date: {
					to: 1082,
					from: [1082],
					serialize: (value: string) => value,
					parse: (value: string) => value
				}
			}
		}
	};
}
