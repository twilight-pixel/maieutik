/**
 * Lecture (D18) : avertissement sur un passage, pagination sans JavaScript, rappel des jurés.
 */
import { expect, test } from '@playwright/test';
import { createMnemonic, derivePseudonymKeypair, mnemonicToSeed } from '../src/lib/shared/identity';
import { sign } from '../src/lib/shared/signature';
import { solveChallenge, type PowChallenge } from '../src/lib/shared/pow';
import type { TextVersionPayload } from '../src/lib/shared/payloads';
import { createIdentity } from './ui-helpers';

test('un passage averti est replié, le reste du texte non', async ({ request, browser }) => {
	const author = derivePseudonymKeypair(mnemonicToSeed(createMnemonic()));
	const challenge = (await (await request.get('/api/pow')).json()) as PowChallenge;
	await request.post('/api/pseudonyms', {
		data: {
			envelope: sign('pseudonym', { displayName: 'Témoin' }, author.secretKey),
			pow: await solveChallenge(challenge)
		}
	});
	const text: TextVersionPayload = {
		textId: crypto.randomUUID(),
		version: 1,
		category: 'history/events',
		lang: 'fr',
		kind: 'testimony',
		title: 'Témoignage avec un passage difficile',
		body: {
			type: 'doc',
			content: [
				{ type: 'paragraph', content: [{ type: 'text', text: 'Introduction lisible.' }] },
				{
					type: 'warningBlock',
					attrs: { warnings: ['violence'] },
					content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Récit violent.' }] }]
				}
			]
		},
		tags: [],
		warnings: [],
		relation: null,
		question: null,
		sources: [],
		deferred: false
	};
	const published = await request.post('/api/texts', {
		data: { envelope: sign('text-version', text, author.secretKey) }
	});
	expect(published.status()).toBe(201);

	// Sans JavaScript : introduction visible, passage averti replié.
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto(`/textes/${text.textId}`);
	await expect(page.getByText('Introduction lisible.')).toBeVisible();
	await expect(page.getByText('Récit violent.')).toBeHidden();
	await page.locator('summary', { hasText: 'Violence' }).click();
	await expect(page.getByText('Récit violent.')).toBeVisible();
	await context.close();
});

test('pagination par liens, en conservant la langue et les filtres', async ({ request }) => {
	const html = await (await request.get('/en/journal?page=2')).text();
	// Liens relatifs (compatibles avec l'accès onion) : « ../en/journal » ou « /en/journal ».
	expect(html).toMatch(/<a[^>]*href="[./]*en\/journal"[^>]*rel="prev"/);
	const questions = await (await request.get('/questions?tri=contradictoires&page=2')).text();
	expect(questions).toMatch(/href="[./]*questions\?tri=contradictoires"[^>]*rel="prev"/);
});

test('rappel discret des votes de juré en attente', async ({ page }) => {
	test.setTimeout(120_000);
	await createIdentity(page, 'Jure');
	// Volontaire déclaré sur cet appareil, deux votes en attente déjà vérifiés cette session.
	const publicKey = await page
		.getByRole('link', { name: 'Voir l’œuvre' })
		.first()
		.getAttribute('href')
		.then((href) => href!.split('/').pop()!);
	await page.evaluate((key) => {
		localStorage.setItem(`maieutik:jury-volunteer:${key}`, '1');
		sessionStorage.setItem(`maieutik:jury-pending:${key}`, '2');
	}, publicKey);
	await page.goto('/disciplines');
	const badge = page.locator('a.badge');
	await expect(badge).toBeVisible();
	await expect(badge).toContainText('2');
	await badge.click();
	await expect(page).toHaveURL(/\/jury$/);
});
