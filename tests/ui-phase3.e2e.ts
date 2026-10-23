/**
 * Phase 3 dans un vrai navigateur : transfert d'identité vers un autre appareil (texte du QR
 * code + code à usage unique), puis remplacement de la phrase avec rotation des pseudonymes.
 */
import { expect, test } from '@playwright/test';
import { createIdentity } from './ui-helpers';

test('transfert vers un autre appareil puis rotation de clé', async ({ page, browser }) => {
	test.setTimeout(180_000);
	const name = await createIdentity(page, 'Voyageur');

	// Appareil A : QR code et code à usage unique.
	await page.locator('summary', { hasText: 'Transférer vers un autre appareil' }).click();
	await page.getByRole('button', { name: 'Afficher le QR code' }).click();
	await expect(page.getByRole('img', { name: 'Transférer vers un autre appareil' })).toBeVisible();
	const code = (await page.locator('strong.code').innerText()).trim();
	await page.locator('summary', { hasText: 'Ou copiez ce texte' }).click();
	const transfer = await page.locator('textarea[readonly]').inputValue();
	expect(transfer.startsWith('MAIEUTIK1:')).toBe(true);

	// Appareil B : contexte séparé (autre stockage), import par le texte et le code.
	const other = await browser.newContext();
	const second = await other.newPage();
	await second.goto('/identite');
	await second.locator('summary', { hasText: 'Recevoir d’un autre appareil' }).click();
	await second.getByLabel('Texte de transfert').fill(transfer);
	await second.getByLabel('Code à usage unique').fill(code.toLowerCase());
	await second.getByRole('button', { name: 'Importer' }).click();
	await expect(second.getByText(name).first()).toBeVisible();
	await expect(second.getByText('actif')).toBeVisible();
	await other.close();

	// Appareil A : remplacement de la phrase, rotation signée par l'ancienne et la nouvelle clé.
	await page.locator('summary', { hasText: 'Clé compromise ?' }).click();
	await page.getByRole('button', { name: 'Remplacer ma phrase de récupération' }).click();
	const words = (await page.locator('details[open] ol.words li').allInnerTexts()).map((w) =>
		w.trim()
	);
	expect(words).toHaveLength(12);
	await page.locator('details[open]').getByRole('button', { name: 'Je les ai notés' }).click();
	for (const field of await page
		.locator('details[open]')
		.getByLabel(/Mot n° \d+/)
		.all()) {
		const label = await field.evaluate((el) => el.closest('label')?.textContent ?? '');
		await field.fill(words[Number(label.match(/\d+/)?.[0]) - 1]);
	}
	await page.locator('details[open]').getByRole('button', { name: 'Confirmer' }).click();
	await expect(page.getByText('Vos pseudonymes ont été déplacés')).toBeVisible({
		timeout: 90_000
	});

	// L'ancienne clé est marquée « déplacée » ; le pseudonyme actif est la nouvelle clé.
	await page.getByRole('link', { name: 'Voir l’œuvre' }).first().click();
	await expect(page.getByText('Anciennement')).toBeVisible();
});
