import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TAXONOMY } from './content';
import en from '../../../messages/en.json';
import fr from '../../../messages/fr.json';

const expectedIds = Object.entries(TAXONOMY).flatMap(([category, subs]) => [
	category,
	...subs.map((sub) => `${category}/${sub}`)
]);

describe('taxonomie', () => {
	it('est alignée avec la migration SQL', () => {
		const sql = readFileSync('db/migrations/0002_taxonomy.sql', 'utf-8');
		const seeded = [...sql.matchAll(/^\t\('([^']+)'/gm)].map((match) => match[1]);
		expect(seeded).toEqual(expectedIds);
	});

	it('a un libellé FR et EN pour chaque identifiant', () => {
		for (const id of expectedIds) {
			const key = `category_${id.replaceAll(/[/-]/g, '_')}`;
			expect(fr, `fr : ${key}`).toHaveProperty(key);
			expect(en, `en : ${key}`).toHaveProperty(key);
		}
	});
});
