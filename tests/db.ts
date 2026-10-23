/**
 * Accès direct à la base de test, réservé aux préparations impossibles par l'API
 * (par exemple vieillir un pseudonyme pour atteindre l'ancienneté requise des jurés).
 */
import { existsSync, readFileSync } from 'node:fs';
import postgres from 'postgres';
import { databaseConnection } from '../src/lib/server/db-options';

function env(): Record<string, string | undefined> {
	if (process.env.DATABASE_URL || process.env.PGHOST || !existsSync('.env')) return process.env;
	const local = Object.fromEntries(
		readFileSync('.env', 'utf-8')
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith('#') && line.includes('='))
			.map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])
	);
	return { ...process.env, ...local };
}

export function testDatabase() {
	const { url, options } = databaseConnection(env());
	return url ? postgres(url, options) : postgres(options);
}
