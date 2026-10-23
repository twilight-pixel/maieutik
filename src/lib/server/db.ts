import postgres from 'postgres';
import { DATABASE_PASSWORD_FILE, DATABASE_URL } from '$app/env/private';
import { databaseConnection } from './db-options';

/**
 * Connexion Postgres partagée. Aucune donnée de requête (IP, en-têtes) ne doit
 * transiter vers la base : voir CLAUDE.md, « Anonymat dans l'architecture ».
 */
const { url, options } = databaseConnection({
	...process.env,
	DATABASE_URL,
	DATABASE_PASSWORD_FILE
});

export const sql = url ? postgres(url, options) : postgres(options);
