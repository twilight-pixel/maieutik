/**
 * Parcours de la phase 2 dans un vrai navigateur : poser une question, y défendre une
 * position avec une source citée dans le corps, puis la réfuter.
 */
import { expect, test } from '@playwright/test';
import { createIdentity } from './ui-helpers';

test('question, position sourcée et réfutation', async ({ page }) => {
	test.setTimeout(150_000);
	const author = await createIdentity(page, 'Questionneur');

	await page.goto('/questions/nouvelle');
	await page.getByLabel('Question').fill('La lecture lente est-elle un luxe ?');
	await page.getByLabel('Discipline').selectOption('society/education');
	await page.getByRole('button', { name: 'Signer et poser la question' }).click();
	await expect(page).toHaveURL(/\/questions\/[0-9a-f-]{36}$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'La lecture lente est-elle un luxe ?'
	);

	await page.getByRole('link', { name: 'Défendre une position' }).click();
	await page.getByRole('textbox', { name: 'Titre', exact: true }).fill('Un luxe nécessaire');

	await page.getByRole('button', { name: 'Ajouter une source' }).click();
	await page
		.getByRole('textbox', { name: 'Titre', exact: true })
		.nth(1)
		.fill('Éloge de la lenteur');
	await page.getByLabel('Auteur').fill('Carl Honoré');
	await page.getByLabel(/^Date/).fill('2004');

	const editor = page.getByRole('textbox', { name: 'Texte' });
	await editor.click();
	await editor.pressSequentially('Lire lentement améliore la compréhension');
	// Sélection du passage puis renvoi vers la source 1.
	await page.keyboard.press('Shift+Home');
	await page.getByRole('button', { name: 'Citer la source 1' }).click();
	await page.getByRole('button', { name: 'Signer et publier' }).click();

	await expect(page).toHaveURL(/\/textes\/[0-9a-f-]{36}$/);
	await expect(page.getByText('Position sur la question')).toBeVisible();
	await expect(page.locator('sup.source-ref a')).toHaveText('[1]');
	await expect(page.locator('#source-s1')).toContainText('Carl Honoré');

	// Réfutation de sa propre position, par le bouton dédié.
	await page.getByRole('link', { name: 'Réfuter' }).click();
	await expect(page.getByLabel('Nature de votre réponse')).toHaveValue('refutes');
	await page.getByRole('textbox', { name: 'Titre', exact: true }).fill('Un luxe, vraiment ?');
	const reply = page.getByRole('textbox', { name: 'Texte' });
	await reply.click();
	await reply.pressSequentially('Le temps de lecture dépend surtout du travail.');
	await page.getByRole('button', { name: 'Signer et publier' }).click();

	await expect(page).toHaveURL(/\/textes\/[0-9a-f-]{36}$/);
	await expect(page.getByText('Réfute', { exact: true })).toBeVisible();
	await expect(page.getByText('Discussion sur la question')).toBeVisible();

	// Fil de discussion sur la page de la question : la réfutation y figure, sans réponse.
	await page.getByRole('link', { name: /La lecture lente est-elle un luxe/ }).click();
	await expect(page.getByText('Fil de discussion')).toBeVisible();
	const thread = page.locator('.thread');
	await expect(thread.getByRole('link', { name: 'Un luxe, vraiment ?' })).toBeVisible();
	await expect(thread.getByText('réfutation sans réponse')).toBeVisible();

	// Dans les listes : début du texte et signaux structurels (sources, réfutation sans réponse).
	await page.goto('/disciplines/society/education');
	// La base de test garde les passages précédents : on isole la ligne par son auteur.
	const row = page.getByRole('listitem').filter({ hasText: 'Un luxe nécessaire' }).filter({
		hasText: author
	});
	await expect(row).toContainText('Lire lentement améliore la compréhension');
	await expect(row).toContainText('1 source');
	await expect(row).toContainText('1 réfutation sans réponse');
});
