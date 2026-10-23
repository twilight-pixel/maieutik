/**
 * Écrire avant d'avoir un pseudonyme : le formulaire est disponible tout de suite, le texte est
 * gardé en brouillon sur l'appareil (il survit au rechargement), l'identité n'est demandée qu'au
 * moment de signer, puis on revient au texte et on publie.
 */
import { expect, test } from '@playwright/test';

test('écrire sans pseudonyme, garder le brouillon, créer le pseudonyme au moment de signer', async ({
	page
}) => {
	test.setTimeout(150_000);

	await page.goto('/ecrire');
	const title = page.getByRole('textbox', { name: 'Titre', exact: true });
	await expect(title).toBeVisible();
	await expect(page.getByText('Pas encore de pseudonyme')).toBeVisible();

	await title.fill('Brouillon avant identité');
	await page.getByLabel('Discipline').selectOption('philosophy/ethics');
	const editor = page.getByRole('textbox', { name: 'Texte' });
	await editor.click();
	await editor.pressSequentially('Un texte commencé sans pseudonyme.');
	await expect(page.getByText('Brouillon enregistré sur cet appareil')).toBeVisible({
		timeout: 10_000
	});

	// Le brouillon survit au rechargement, avec le titre, la discipline et le corps.
	await page.reload();
	await expect(page.getByText('Brouillon retrouvé')).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Titre', exact: true })).toHaveValue(
		'Brouillon avant identité'
	);
	await expect(page.getByLabel('Discipline')).toHaveValue('philosophy/ethics');
	await expect(page.getByText('Un texte commencé sans pseudonyme.')).toBeVisible();

	// Signer sans pseudonyme : le texte est gardé et on propose d'en créer un.
	await page.getByRole('button', { name: 'Signer et publier' }).click();
	await expect(page.getByText('Votre texte est prêt.')).toBeVisible();
	await page.getByRole('link', { name: 'Créer ou ouvrir mon pseudonyme' }).click();
	await expect(page).toHaveURL(/\/identite\?retour=/);

	// Création guidée du pseudonyme (phrase vérifiée) : on revient ensuite au texte.
	await page.getByRole('button', { name: 'Créer une identité' }).click();
	const words = (await page.getByTestId('mnemonic').locator('li').allInnerTexts()).map((w) =>
		w.trim()
	);
	await page.getByRole('button', { name: 'Je les ai notés' }).click();
	for (const field of await page.getByLabel(/Mot n° \d+/).all()) {
		const label = await field.evaluate((el) => el.closest('label')?.textContent ?? '');
		await field.fill(words[Number(label.match(/\d+/)?.[0]) - 1]);
	}
	await page.getByRole('button', { name: 'Confirmer' }).click();
	await page.getByLabel('Nom d’affichage').fill(`Brouillon${Date.now() % 100_000}`);
	await page.getByRole('button', { name: 'Créer le pseudonyme' }).click();

	await expect(page).toHaveURL(/\/ecrire$/, { timeout: 90_000 });
	await expect(page.getByRole('textbox', { name: 'Titre', exact: true })).toHaveValue(
		'Brouillon avant identité'
	);
	await page.getByRole('button', { name: 'Signer et publier' }).click();
	await expect(page).toHaveURL(/\/textes\/[0-9a-f-]{36}$/, { timeout: 60_000 });
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Brouillon avant identité');

	// Publié : le brouillon est effacé, un nouveau texte repart d'une page vierge.
	await page.goto('/ecrire');
	await expect(page.getByRole('textbox', { name: 'Titre', exact: true })).toHaveValue('');
	await expect(page.getByText('Brouillon retrouvé')).toHaveCount(0);
});

test('repartir de zéro efface le brouillon', async ({ page }) => {
	await page.goto('/ecrire');
	await page.getByRole('textbox', { name: 'Titre', exact: true }).fill('À jeter');
	await expect(page.getByText('Brouillon enregistré sur cet appareil')).toBeVisible({
		timeout: 10_000
	});
	await page.reload();
	await expect(page.getByText('Brouillon retrouvé')).toBeVisible();
	await page.getByRole('button', { name: 'Repartir de zéro' }).click();
	await expect(page.getByRole('textbox', { name: 'Titre', exact: true })).toHaveValue('');
	await page.reload();
	await expect(page.getByText('Brouillon retrouvé')).toHaveCount(0);
});
