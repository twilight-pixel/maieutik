/**
 * Parcours utilisateur de la phase 1 dans un vrai navigateur : création d'identité avec
 * sauvegarde vérifiée, pseudonyme, écriture d'un texte, lecture, persistance au rechargement.
 */
import { expect, test } from '@playwright/test';
import { createIdentity } from './ui-helpers';

test('créer une identité puis publier un texte', async ({ page }) => {
	test.setTimeout(120_000);
	await createIdentity(page);

	// L'identité survit au rechargement (coffre chiffré dans IndexedDB).
	await page.reload();
	await expect(page.getByText('actif')).toBeVisible();

	await page.getByRole('link', { name: 'Écrire un texte' }).click();
	await page.getByRole('textbox', { name: 'Titre', exact: true }).fill('Éloge de la lenteur');
	await page.getByLabel('Discipline').selectOption('philosophy/ethics');
	const editor = page.getByRole('textbox', { name: 'Texte' });
	await editor.click();
	await editor.pressSequentially('Penser lentement, c’est penser deux fois.');
	await page.getByRole('button', { name: 'Signer et publier' }).click();

	await expect(page).toHaveURL(/\/textes\/[0-9a-f-]{36}$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Éloge de la lenteur');
	await expect(page.getByText('Penser lentement')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Publier une nouvelle version' })).toBeVisible();
});
