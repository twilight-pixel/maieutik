/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/**
 * Service worker de l'application installable (PWA, docs/08).
 *
 * - Le code de l'application et les fichiers statiques sont mis en cache à l'installation.
 * - Les pages : réseau d'abord, copie en cache seulement hors connexion (lecture déjà faite).
 * - Jamais de cache pour l'API, l'interface interne, les exports ni les requêtes non GET :
 *   elles portent des contenus signés ou des décisions qui doivent rester à jour.
 * - Rien n'est envoyé ailleurs qu'à l'origine du site.
 */
import { self } from '$app/service-worker';
import { assets, immutable } from '$app/manifest';
import { version } from '$app/env';

const CACHE = `maieutik-${version}`;
// Chemins relatifs à la base : on les ramène à des chemins absolus, comparables à l'URL demandée.
const PRECACHE = [...immutable, ...assets].map((f) =>
	f.path.startsWith('/') ? f.path : `/${f.path}`
);
const NEVER = [/^\/api\//, /^\/internal\//, /^\/\.well-known\//, /^\/healthz$/, /\.json$/];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(PRECACHE))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
			)
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== 'GET' || url.origin !== self.location.origin) return;
	if (NEVER.some((pattern) => pattern.test(url.pathname))) return;

	// Code et fichiers statiques : cache d'abord (noms immuables, versionnés).
	if (PRECACHE.includes(url.pathname)) {
		event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
		return;
	}

	// Pages : réseau d'abord ; la copie en cache ne sert que hors connexion.
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request)
				.then((response) => {
					const cacheable =
						response.ok && !(response.headers.get('cache-control') ?? '').includes('no-store');
					if (cacheable) {
						const copy = response.clone();
						event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
					}
					return response;
				})
				.catch(async () => (await caches.match(request)) ?? Response.error())
		);
	}
});
