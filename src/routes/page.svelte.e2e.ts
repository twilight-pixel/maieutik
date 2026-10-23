import { expect, test } from '@playwright/test';

test('la landing tient dans la hauteur de l’écran', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/');
	await expect(page.locator('h1')).toHaveText('Une bibliothèque vivante de débats écrits');
	const height = await page.evaluate(() => document.documentElement.scrollHeight);
	expect(height).toBeLessThanOrEqual(800);
});

test('affiche les 8 disciplines en français par défaut', async ({ page }) => {
	await page.goto('/disciplines');
	const tops = page.getByRole('navigation', { name: 'Disciplines' }).getByRole('link');
	await expect(tops).toHaveCount(8);
	await expect(tops.filter({ hasText: 'Philosophie' })).toBeVisible();
});

test('bascule en anglais par l’URL, sans cookie', async ({ page, context }) => {
	await page.goto('/en/disciplines');
	await expect(
		page.getByRole('navigation', { name: 'Disciplines' }).getByRole('link', { name: 'Philosophy' })
	).toBeVisible();
	expect(await context.cookies()).toEqual([]);
});
