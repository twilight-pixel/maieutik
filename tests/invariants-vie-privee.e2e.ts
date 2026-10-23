/**
 * Invariants de vie privée vérifiés sur chaque page publique (docs/09 §3).
 * Complète src/routes/page.svelte.e2e.ts, qui couvre la page d'accueil.
 *
 * Le HTML servi est enregistré dans test-results/pages, que la CI passe ensuite à
 * scripts/ci/check-external-resources.mjs (balises, CSS en ligne, liens sans noreferrer).
 */
import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Pages publiques à couvrir : ajouter chaque nouvelle route lisible sans compte.
const ROUTES = [
	'/',
	'/en',
	'/disciplines',
	'/en/disciplines',
	'/disciplines/philosophy',
	'/disciplines/philosophy/ethics',
	'/disciplines?q=libert%C3%A9',
	'/journal',
	'/questions',
	'/questions?discipline=politics',
	'/questions?tri=contradictoires',
	'/questions/nouvelle',
	'/a-repondre',
	'/jurys',
	'/jury',
	'/preferences',
	'/en/a-repondre',
	'/identite',
	'/ecrire'
];
const PAGES_DIR = 'test-results/pages';
// Une date suivie d'une heure : seules les dates sont exposées (D09).
const DATE_TIME = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

for (const route of ROUTES) {
	test.describe(`invariants ${route}`, () => {
		test('aucune requête vers une autre origine, aucun cookie', async ({
			page,
			context,
			baseURL
		}) => {
			const origin = new URL(route, baseURL).origin;
			const foreign: string[] = [];
			page.on('request', (request) => {
				const url = new URL(request.url());
				if (!['data:', 'blob:'].includes(url.protocol) && url.origin !== origin) {
					foreign.push(request.url());
				}
			});
			const response = await page.goto(route, { waitUntil: 'networkidle' });
			expect(response?.status()).toBeLessThan(400);
			expect(foreign).toEqual([]);
			expect(response?.headers()['set-cookie']).toBeUndefined();
			expect(await context.cookies()).toEqual([]);

			await mkdir(PAGES_DIR, { recursive: true });
			const name = route === '/' ? 'index' : route.replace(/^\/|\/$/g, '').replace(/[^\w.-]/g, '_');
			// HTML servi, pas le DOM : Vite y injecte des préchargements en URL absolue, sans effet
			// sur l'accès onion (la requête réseau ci-dessus les couvre déjà).
			await writeFile(`${PAGES_DIR}/${name}.html`, (await response?.text()) ?? '');
		});

		test('en-têtes de sécurité', async ({ request }) => {
			const headers = (await request.get(route)).headers();
			const csp = headers['content-security-policy'] ?? '';
			expect(csp).toContain("default-src 'self'");
			expect(csp).toContain("frame-ancestors 'none'");
			expect(csp).not.toContain('unsafe-eval');
			expect(csp).not.toMatch(/script-src[^;]*(https?:|\*)/);
			expect(headers['referrer-policy']).toBe('no-referrer');
			expect(headers['x-content-type-options']).toBe('nosniff');
			// Caméra : seule l'origine elle-même (lecture du QR code de transfert, D16). Le reste : rien.
			const permissions = (headers['permissions-policy'] ?? '').split(/,\s*/);
			expect(permissions.filter((p) => p.startsWith('camera='))).toEqual(['camera=(self)']);
			for (const feature of ['microphone', 'geolocation', 'interest-cohort', 'browsing-topics']) {
				expect(permissions).toContain(`${feature}=()`);
			}
			expect(headers['x-powered-by']).toBeUndefined();
		});

		test('aucune heure exposée', async ({ request }) => {
			const html = await (await request.get(route)).text();
			expect(html).not.toMatch(DATE_TIME);
			for (const [, value] of html.matchAll(/<time[^>]*\bdatetime="([^"]*)"/g)) {
				expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			}
		});

		test('lisible sans JavaScript', async ({ browser }) => {
			const context = await browser.newContext({ javaScriptEnabled: false });
			const page = await context.newPage();
			await page.goto(route);
			await expect(page.locator('h1')).toBeVisible();
			expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(0);
			await context.close();
		});
	});
}
