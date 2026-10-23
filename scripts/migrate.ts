/**
 * Applique les migrations SQL de db/migrations dans l'ordre, chacune dans une transaction.
 * Usage : node scripts/migrate.ts (Node ≥ 22.18, exécution directe du TypeScript).
 * Connexion : DATABASE_URL, ou PG* + DATABASE_PASSWORD_FILE (voir src/lib/server/db-options.ts).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { databaseConnection } from '../src/lib/server/db-options.ts';

const dir = join(import.meta.dirname, '..', 'db', 'migrations');
const { url, options } = databaseConnection(process.env);
const sql = url ? postgres(url, options) : postgres(options);

try {
	await sql`create table if not exists schema_migration (name text primary key, applied_on date not null default current_date)`;
	const applied = new Set(
		(await sql<{ name: string }[]>`select name from schema_migration`).map((row) => row.name)
	);
	const pending = readdirSync(dir)
		.filter((file) => file.endsWith('.sql') && !applied.has(file))
		.sort();

	for (const file of pending) {
		await sql.begin(async (tx) => {
			await tx.unsafe(readFileSync(join(dir, file), 'utf-8'));
			await tx`insert into schema_migration (name) values (${file})`;
		});
		console.log(`appliquée : ${file}`);
	}
	if (pending.length === 0) console.log('base à jour');
} finally {
	await sql.end();
}
