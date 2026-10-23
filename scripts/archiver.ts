/**
 * Robot d'archivage des sources (docs/04 §5, docs/08 « Points délicats »).
 *
 * Tourne dans son propre conteneur : accès Internet, aucun accès à la base ni aux réseaux
 * internes. Il demande à l'application les adresses à archiver, les télécharge avec des
 * garde-fous (adresses internes refusées, taille et durée bornées, redirections revérifiées),
 * puis renvoie un instantané textuel et l'empreinte SHA-256 du contenu brut.
 *
 * Usage : APP_URL=http://app:3000 ARCHIVER_TOKEN_FILE=/run/secrets/archiver_token node scripts/archiver.ts
 * Option : --once (un seul passage, pour les tests).
 */
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import { extractTitle, htmlToText, isBlockedAddress } from '../src/lib/server/archive-safety.ts';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const TOKEN = readFileSync(
	process.env.ARCHIVER_TOKEN_FILE ?? '/run/secrets/archiver_token',
	'utf-8'
).trim();
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const IDLE_MS = 60_000;
const TEXT_TYPES = ['text/html', 'application/xhtml+xml', 'text/plain'];

class Refused extends Error {}

/** Résolution DNS filtrée : utilisée par la connexion elle-même, elle empêche le rebinding. */
const safeLookup: LookupFunction = (hostname, options, callback) => {
	lookup(hostname, { ...options, all: true }, (error, addresses) => {
		if (error) return callback(error, '', 0);
		const list = addresses as { address: string; family: number }[];
		const blocked = list.find((entry) => isBlockedAddress(entry.address));
		if (list.length === 0 || blocked) {
			return callback(new Refused(`adresse interdite pour ${hostname}`), '', 0);
		}
		if ((options as { all?: boolean }).all) {
			return (callback as unknown as (e: null, a: typeof list) => void)(null, list);
		}
		callback(null, list[0].address, list[0].family);
	});
};

type Download = { contentType: string; body: Buffer };

// `timeout` de http.get ne mesure que l'inactivité : un serveur qui envoie un octet toutes les
// quelques secondes le contournerait. `deadline` borne la durée totale, redirections comprises.
function download(url: URL, redirects = 0, deadline = Date.now() + TIMEOUT_MS): Promise<Download> {
	if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Refused('protocole refusé');
	if (url.port && url.port !== '80' && url.port !== '443') throw new Refused('port refusé');
	if (url.username || url.password) throw new Refused('identifiants dans l’adresse');
	const client = url.protocol === 'https:' ? https : http;

	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => request.destroy(new Error('délai total dépassé')),
			Math.max(0, deadline - Date.now())
		);
		const done =
			<T>(settle: (value: T) => void) =>
			(value: T) => {
				clearTimeout(timer);
				settle(value);
			};
		resolve = done(resolve);
		reject = done(reject);
		const request = client.get(
			url,
			{
				lookup: safeLookup,
				timeout: TIMEOUT_MS,
				headers: {
					'user-agent': 'MaieutikArchiver/1',
					accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5'
				}
			},
			(response) => {
				const status = response.statusCode ?? 0;
				if (status >= 300 && status < 400 && response.headers.location) {
					response.resume();
					if (redirects >= MAX_REDIRECTS) return reject(new Refused('trop de redirections'));
					// Chaque redirection repasse par toutes les vérifications.
					return download(new URL(response.headers.location, url), redirects + 1, deadline).then(
						resolve,
						reject
					);
				}
				if (status !== 200) {
					response.resume();
					return reject(new Error(`statut ${status}`));
				}
				const chunks: Buffer[] = [];
				let size = 0;
				response.on('data', (chunk: Buffer) => {
					size += chunk.length;
					if (size > MAX_BYTES) {
						request.destroy(new Refused('contenu trop volumineux'));
						return;
					}
					chunks.push(chunk);
				});
				response.on('end', () =>
					resolve({
						contentType: (response.headers['content-type'] ?? 'application/octet-stream')
							.split(';')[0]
							.trim()
							.toLowerCase(),
						body: Buffer.concat(chunks)
					})
				);
				response.on('error', reject);
			}
		);
		request.on('timeout', () => request.destroy(new Error('délai dépassé')));
		request.on('error', reject);
	});
}

async function archive(url: string) {
	try {
		const { contentType, body } = await download(new URL(url));
		const sha256 = createHash('sha256').update(body).digest('hex');
		let title: string | null = null;
		let text = '';
		if (TEXT_TYPES.includes(contentType)) {
			const raw = body.toString('utf-8');
			title = contentType === 'text/plain' ? null : extractTitle(raw);
			text = contentType === 'text/plain' ? raw : htmlToText(raw);
		}
		return { url, status: 'archived', contentType, sha256, title, text };
	} catch (error) {
		return { url, status: error instanceof Refused ? 'refused' : 'failed' };
	}
}

async function call(path: string, body?: unknown) {
	const response = await fetch(new URL(path, APP_URL), {
		method: 'POST',
		headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	if (!response.ok) throw new Error(`${path} : statut ${response.status}`);
	return response.json() as Promise<{ urls?: string[] }>;
}

async function pass(): Promise<number> {
	const { urls = [] } = await call('/internal/archive/jobs');
	for (const url of urls) {
		const result = await archive(url);
		await call('/internal/archive/results', result);
		console.log(`archivage : ${result.status}`);
	}
	return urls.length;
}

const once = process.argv.includes('--once');
do {
	try {
		const count = await pass();
		if (once) break;
		if (count === 0) await new Promise((resolve) => setTimeout(resolve, IDLE_MS));
	} catch (error) {
		console.error('robot d’archivage :', error instanceof Error ? error.message : 'erreur');
		if (once) process.exitCode = 1;
		if (once) break;
		await new Promise((resolve) => setTimeout(resolve, IDLE_MS));
	}
} while (!once);
