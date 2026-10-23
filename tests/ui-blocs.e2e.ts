/**
 * Éditeur enrichi (D17) dans un vrai navigateur : tableaux, formules, encadrés, colonnes,
 * frises et schémas, de la saisie jusqu'à la lecture, y compris sans JavaScript.
 */
import { expect, test, type Page } from '@playwright/test';
import { createIdentity } from './ui-helpers';

const editorOf = (page: Page) => page.getByRole('textbox', { name: 'Texte' });
const tool = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

/** Remplit le panneau de saisie ouvert (formule, frise ou schéma). */
async function fillPanel(page: Page, text: string) {
	await page.locator('.editor .panel textarea').fill(text);
}

test('écrire avec tous les blocs, publier, puis lire (avec et sans JavaScript)', async ({
	page,
	browser
}) => {
	test.setTimeout(240_000);
	await createIdentity(page, 'Blocs');
	await page.goto('/ecrire');
	await page.getByRole('textbox', { name: 'Titre', exact: true }).fill('Des blocs pour argumenter');
	await page.getByLabel('Discipline').selectOption('philosophy/logic');
	const editor = editorOf(page);
	await editor.click();

	// Raccourcis Markdown : titre, formule dans une ligne.
	await editor.pressSequentially('## Une thèse');
	await editor.press('Enter');
	await editor.pressSequentially('Soit $x^2$ une fonction.');
	await editor.press('Enter');
	await expect(editor.locator('h2')).toHaveText('Une thèse');
	await expect(editor.locator('.math-inline .katex')).toBeVisible();

	// Encadré par « ::: », puis sortie par Entrée sur une ligne vide.
	await editor.pressSequentially(':::');
	await editor.press('Space');
	await editor.pressSequentially('Un terme défini.');
	await expect(editor.locator('.callout-remark')).toContainText('Un terme défini.');
	await editor.press('Enter');
	await editor.press('Enter');

	// Tableau : en-têtes, puis une ligne ajoutée par la barre contextuelle.
	await tool(page, 'Tableau').click();
	await page.keyboard.type('Auteur');
	await page.keyboard.press('Tab');
	await page.keyboard.type('Thèse');
	await page.keyboard.press('Tab');
	await page.keyboard.type('Preuve');
	await page.getByRole('button', { name: 'Ligne en dessous' }).click();
	await expect(editor.locator('tr')).toHaveCount(4);

	// Formule en bloc, saisie dans le panneau avec aperçu.
	await editor.press('Control+End');
	await tool(page, 'Formule').click();
	await page.getByLabel('Sur sa propre ligne').check();
	await fillPanel(page, '\\int_0^1 x^2\\,dx = \\frac{1}{3}');
	await expect(page.locator('.editor .panel-preview .katex')).toBeVisible();
	await page.getByRole('button', { name: 'Insérer', exact: true }).click();
	await expect(editor.locator('.math-block-atom .katex-display')).toBeVisible();

	// Frise chronologique.
	await editor.press('Control+End');
	await tool(page, 'Frise chronologique').click();
	await fillPanel(page, '1789 | Prise de la Bastille | Début de la Révolution\n1792 | République');
	await page.getByRole('button', { name: 'Insérer', exact: true }).click();
	await expect(editor.locator('.block-atom li')).toHaveCount(2);

	// Schéma.
	await editor.press('Control+End');
	await tool(page, 'Schéma').click();
	await fillPanel(page, 'Prémisse -> Conclusion : donc\nObjection -> Prémisse : conteste');
	await expect(page.locator('.editor .panel-preview svg')).toBeVisible();
	await page.getByRole('button', { name: 'Insérer', exact: true }).click();
	await expect(editor.locator('.block-atom svg')).toBeVisible();

	// Colonnes : thèse et réfutation côte à côte.
	await editor.press('Control+End');
	await tool(page, 'Colonnes').click();
	await page.keyboard.type('Thèse en regard');
	await expect(editor.locator('.columns .column')).toHaveCount(2);

	await page.getByRole('button', { name: 'Signer et publier' }).click();
	// Signature, preuve de travail et enregistrement : plus long qu'un simple clic en développement.
	await expect(page).toHaveURL(/\/textes\/[0-9a-f-]{36}$/, { timeout: 60_000 });
	const url = page.url();

	const expectRendered = async (reader: Page) => {
		await expect(reader.getByRole('heading', { level: 2, name: 'Une thèse' })).toBeVisible();
		await expect(reader.locator('.katex')).toHaveCount(2);
		await expect(reader.locator('.katex-display')).toHaveCount(1);
		await expect(reader.locator('.callout-remark')).toContainText('Un terme défini.');
		await expect(reader.getByRole('columnheader', { name: 'Auteur' })).toBeVisible();
		await expect(reader.locator('table tr')).toHaveCount(4);
		await expect(reader.locator('ol li', { hasText: 'Prise de la Bastille' })).toBeVisible();
		await expect(reader.getByRole('img', { name: 'Schéma' })).toBeVisible();
		await expect(reader.getByText('Prémisse → Conclusion : donc')).toBeAttached();
		await expect(reader.locator('.columns-2')).toContainText('Thèse en regard');
	};
	await expectRendered(page);

	// La lecture ne demande pas de JavaScript : même rendu depuis le serveur seul.
	const noScript = await browser.newContext({ javaScriptEnabled: false });
	try {
		const reader = await noScript.newPage();
		await reader.goto(url);
		await expectRendered(reader);
	} finally {
		await noScript.close();
	}
});

test('erreurs de saisie des blocs et aide à la mise en forme', async ({ page }) => {
	test.setTimeout(120_000);
	await createIdentity(page, 'Aide');
	await page.goto('/ecrire');
	await editorOf(page).click();

	// Formule invalide : message clair, insertion impossible.
	await tool(page, 'Formule').click();
	await fillPanel(page, '\\macroinconnue{x}');
	await expect(page.getByRole('alert')).toContainText('Formule invalide');
	await expect(page.getByRole('button', { name: 'Insérer', exact: true })).toBeDisabled();
	await page.keyboard.press('Escape');
	await expect(page.locator('.editor .panel')).toHaveCount(0);

	// Frise : ligne sans titre.
	await tool(page, 'Frise chronologique').click();
	await fillPanel(page, 'sans barre verticale');
	await expect(page.getByRole('alert')).toContainText('Ligne 1');
	await expect(page.getByRole('button', { name: 'Insérer', exact: true })).toBeDisabled();
	await page.locator('.editor .panel').getByRole('button', { name: 'Annuler' }).click();

	// Schéma : relation d'un élément avec lui-même.
	await tool(page, 'Schéma').click();
	await fillPanel(page, 'A -> A');
	await expect(page.getByRole('alert')).toContainText('lui-même');
	await page.locator('.editor .panel').getByRole('button', { name: 'Annuler' }).click();

	// Aide : les raccourcis Markdown et le texte d'indication de l'éditeur vide.
	await expect(page.locator('.prose p.is-editor-empty')).toHaveAttribute(
		'data-placeholder',
		/tapez « ## »/
	);
	await page.getByText('Aide à la mise en forme').click();
	await expect(page.getByText('##␣', { exact: true })).toBeVisible();
	await expect(page.getByText('$x^2$', { exact: true })).toBeVisible();
	await expect(page.getByText('Ctrl+B', { exact: true })).toBeVisible();
});
