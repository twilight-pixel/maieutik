import { expect, type Page } from '@playwright/test';

/** Crée une identité par l'interface (sauvegarde vérifiée, preuve de travail) ; renvoie le nom. */
export async function createIdentity(page: Page, prefix = 'Testeur'): Promise<string> {
	await page.goto('/identite');
	await page.getByRole('button', { name: 'Créer une identité' }).click();

	const words = (await page.getByTestId('mnemonic').locator('li').allInnerTexts()).map((w) =>
		w.trim()
	);
	expect(words).toHaveLength(12);
	await page.getByRole('button', { name: 'Je les ai notés' }).click();

	// Saisie des trois mots demandés (positions tirées au hasard).
	for (const field of await page.getByLabel(/Mot n° \d+/).all()) {
		const label = await field.evaluate((el) => el.closest('label')?.textContent ?? '');
		const position = Number(label.match(/\d+/)?.[0]);
		await field.fill(words[position - 1]);
	}
	await page.getByRole('button', { name: 'Confirmer' }).click();

	const name = `${prefix}${Date.now() % 100_000}`;
	await page.getByLabel('Nom d’affichage').fill(name);
	await page.getByRole('button', { name: 'Créer le pseudonyme' }).click();
	await expect(page.getByText('actif')).toBeVisible({ timeout: 60_000 });
	return name;
}
