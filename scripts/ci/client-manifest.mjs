#!/usr/bin/env node
// Manifeste du code client : empreinte SHA-256 de chaque fichier servi au navigateur.
// Voir docs/decisions/D12-integrite-du-code-servi.md.
//
//   generate <dossier> [--version <v>] [--out <fichier>]
//   compare <manifeste-a> <manifeste-b>
//   verify-remote <manifeste> --base <url> [--socks5 <hôte:port>] [--page <chemin>]... [--cert-days <n>]
//
// La racine est le SHA-256 d'une liste au format `sha256sum`, triée par chemin.
// Elle se recalcule sans ce script, depuis le dossier client :
//   find . -type f -printf '%P\n' | LC_ALL=C sort | xargs -d '\n' sha256sum | sha256sum

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { join, relative, sep } from 'node:path';
import tls from 'node:tls';
import { parseArgs, promisify } from 'node:util';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';

const SCHEMA = 1;
const PRECOMPRESSED = /\.(br|gz)$/;
const ENCODINGS = ['identity', 'gzip', 'br'];
const BUILD_INFO_PATH = '.well-known/maieutik/build.json';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

function fail(message) {
	console.error(`erreur : ${message}`);
	process.exit(2);
}

// --- generate ---------------------------------------------------------------

async function listFiles(dir) {
	const entries = await readdir(dir, { recursive: true, withFileTypes: true });
	return entries
		.filter((e) => e.isFile())
		.map((e) =>
			relative(dir, join(e.parentPath ?? e.path, e.name))
				.split(sep)
				.join('/')
		)
		.sort();
}

function rootHash(files) {
	const listing = Object.entries(files)
		.map(([path, hash]) => `${hash}  ${path}\n`)
		.join('');
	return sha256(listing);
}

async function generate(dir, { version, out }) {
	const paths = await listFiles(dir).catch(() => fail(`dossier illisible : ${dir}`));
	if (paths.length === 0) fail(`aucun fichier dans ${dir}`);
	const files = {};
	for (const path of paths) files[path] = sha256(await readFile(join(dir, path)));
	const manifest = { schema: SCHEMA, version: version ?? null, root: rootHash(files), files };
	const json = `${JSON.stringify(manifest, null, 2)}\n`;
	if (out) await writeFile(out, json);
	else process.stdout.write(json);
	console.error(`${paths.length} fichiers, racine ${manifest.root}`);
}

// --- compare ----------------------------------------------------------------

async function loadManifest(path) {
	const manifest = JSON.parse(await readFile(path, 'utf8'));
	if (manifest.schema !== SCHEMA) fail(`${path} : schéma ${manifest.schema} non pris en charge`);
	if (rootHash(manifest.files) !== manifest.root)
		fail(`${path} : racine incohérente avec la liste`);
	return manifest;
}

async function compare(pathA, pathB) {
	const [a, b] = await Promise.all([loadManifest(pathA), loadManifest(pathB)]);
	const diffs = [];
	for (const path of new Set([...Object.keys(a.files), ...Object.keys(b.files)])) {
		if (!(path in b.files)) diffs.push(`- ${path} (absent de ${pathB})`);
		else if (!(path in a.files)) diffs.push(`+ ${path} (absent de ${pathA})`);
		else if (a.files[path] !== b.files[path]) diffs.push(`~ ${path}`);
	}
	if (diffs.length > 0) {
		console.error(`Build non reproductible : ${diffs.length} fichier(s) diffèrent.`);
		for (const d of diffs.sort()) console.error(`  ${d}`);
		process.exit(1);
	}
	console.log(`Builds identiques (${Object.keys(a.files).length} fichiers, racine ${a.root}).`);
}

// --- verify-remote ----------------------------------------------------------

const execFileP = promisify(execFile);

function getDirect(url, encoding) {
	const mod = url.protocol === 'https:' ? https : http;
	return new Promise((resolve, reject) => {
		const req = mod.get(url, { headers: { 'accept-encoding': encoding } }, (res) => {
			const chunks = [];
			res.on('data', (c) => chunks.push(c));
			res.on('end', () =>
				resolve({
					status: res.statusCode,
					encoding: res.headers['content-encoding'] ?? 'identity',
					body: Buffer.concat(chunks)
				})
			);
			res.on('error', reject);
		});
		req.on('error', reject);
		req.setTimeout(60_000, () => req.destroy(new Error('délai dépassé')));
	});
}

// Par Tor : curl sait passer par un proxy SOCKS, pas http.get.
async function getViaSocks(url, encoding, socks) {
	const { stdout } = await execFileP(
		'curl',
		[
			'-sS',
			'--max-time',
			'120',
			'--socks5-hostname',
			socks,
			'-H',
			`Accept-Encoding: ${encoding}`,
			'-D',
			'-',
			url.href
		],
		{ encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 }
	);
	const end = stdout.indexOf('\r\n\r\n');
	const head = stdout.subarray(0, end).toString('latin1').split('\r\n');
	const status = Number(head[0].split(' ')[1]);
	const ce = head.find((l) => /^content-encoding:/i.test(l));
	return {
		status,
		encoding: ce ? ce.split(':')[1].trim().toLowerCase() : 'identity',
		body: stdout.subarray(end + 4)
	};
}

function decode({ encoding, body }) {
	switch (encoding) {
		case 'identity':
			return body;
		case 'gzip':
			return gunzipSync(body);
		case 'br':
			return brotliDecompressSync(body);
		case 'deflate':
			return inflateSync(body);
		default:
			throw new Error(`encodage inconnu : ${encoding}`);
	}
}

async function pool(items, size, worker) {
	const queue = [...items];
	await Promise.all(
		Array.from({ length: size }, async () => {
			while (queue.length > 0) await worker(queue.shift());
		})
	);
}

function certDaysLeft(url) {
	return new Promise((resolve, reject) => {
		const socket = tls.connect(
			{ host: url.hostname, port: Number(url.port) || 443, servername: url.hostname },
			() => {
				const { valid_to: validTo } = socket.getPeerCertificate();
				socket.end();
				resolve((new Date(validTo).getTime() - Date.now()) / 86_400_000);
			}
		);
		socket.on('error', reject);
	});
}

// Chemins de scripts et feuilles de style référencés par une page HTML.
function referencedAssets(html) {
	const refs = [];
	for (const [, tag, attrs] of html.matchAll(/<(script|link)\b([^>]*)>/gi)) {
		const attr = (name) =>
			attrs.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
		if (tag.toLowerCase() === 'script') {
			const src = attr('src');
			if (src) refs.push(src[1] ?? src[2] ?? src[3]);
		} else {
			const rel = attr('rel');
			const href = attr('href');
			if (
				rel &&
				href &&
				/\b(stylesheet|modulepreload|preload)\b/i.test(rel[1] ?? rel[2] ?? rel[3] ?? '')
			) {
				refs.push(href[1] ?? href[2] ?? href[3]);
			}
		}
	}
	return refs;
}

async function verifyRemote(manifestPath, { base, socks5, page = [], 'cert-days': certDays }) {
	if (!base) fail('--base est obligatoire');
	const manifest = await loadManifest(manifestPath);
	const baseUrl = new URL(base.endsWith('/') ? base : `${base}/`);
	const get = (url, encoding = 'identity') =>
		socks5 ? getViaSocks(url, encoding, socks5) : getDirect(url, encoding);
	const errors = [];

	// 1. Version annoncée par le serveur.
	try {
		const res = await get(new URL(BUILD_INFO_PATH, baseUrl));
		const info = JSON.parse(decode(res).toString('utf8'));
		if (info.root !== manifest.root)
			errors.push(`${BUILD_INFO_PATH} : racine ${info.root}, attendue ${manifest.root}`);
		if (manifest.version && info.version !== manifest.version) {
			errors.push(`${BUILD_INFO_PATH} : version ${info.version}, attendue ${manifest.version}`);
		}
	} catch (e) {
		errors.push(`${BUILD_INFO_PATH} : ${e.message}`);
	}

	// 2. Chaque fichier, sous chaque encodage : une variante .br altérée serait servie aux navigateurs.
	const assets = Object.keys(manifest.files).filter((p) => !PRECOMPRESSED.test(p));
	let checked = 0;
	await pool(assets, socks5 ? 4 : 8, async (path) => {
		for (const encoding of ENCODINGS) {
			try {
				const res = await get(new URL(path, baseUrl), encoding);
				if (res.status !== 200) errors.push(`${path} [${encoding}] : HTTP ${res.status}`);
				else if (sha256(decode(res)) !== manifest.files[path])
					errors.push(`${path} [${encoding}] : contenu différent`);
				else checked++;
			} catch (e) {
				errors.push(`${path} [${encoding}] : ${e.message}`);
			}
		}
	});

	// 3. Les pages ne référencent que des fichiers du manifeste.
	for (const p of page) {
		const pageUrl = new URL(p.replace(/^\//, ''), baseUrl);
		try {
			const html = decode(await get(pageUrl)).toString('utf8');
			for (const ref of referencedAssets(html)) {
				const url = new URL(ref, pageUrl);
				const path = url.pathname.slice(baseUrl.pathname.length);
				if (url.origin !== baseUrl.origin)
					errors.push(`${p} : script ou style externe ${url.href}`);
				else if (!(path in manifest.files)) errors.push(`${p} : ${path} absent du manifeste`);
			}
		} catch (e) {
			errors.push(`${p} : ${e.message}`);
		}
	}

	// 4. Certificat TLS (Caddy ne journalise rien : un échec de renouvellement serait invisible).
	if (certDays && baseUrl.protocol === 'https:' && !socks5) {
		try {
			const left = await certDaysLeft(baseUrl);
			if (left < Number(certDays))
				errors.push(`certificat TLS : expire dans ${Math.floor(left)} jours`);
		} catch (e) {
			errors.push(`certificat TLS : ${e.message}`);
		}
	}

	if (errors.length > 0) {
		console.error(`ÉCHEC : ${errors.length} anomalie(s) sur ${baseUrl.origin}`);
		for (const e of errors.sort()) console.error(`  ${e}`);
		process.exit(1);
	}
	console.log(
		`OK : ${checked} réponses conformes au manifeste ${manifest.version ?? ''} (racine ${manifest.root}).`
	);
}

// --- main -------------------------------------------------------------------

const { positionals, values } = parseArgs({
	allowPositionals: true,
	options: {
		version: { type: 'string' },
		out: { type: 'string' },
		base: { type: 'string' },
		socks5: { type: 'string' },
		page: { type: 'string', multiple: true },
		'cert-days': { type: 'string' }
	}
});
const [command, ...args] = positionals;

switch (command) {
	case 'generate':
		if (args.length !== 1) fail('usage : generate <dossier> [--version <v>] [--out <fichier>]');
		await generate(args[0], values);
		break;
	case 'compare':
		if (args.length !== 2) fail('usage : compare <manifeste-a> <manifeste-b>');
		await compare(args[0], args[1]);
		break;
	case 'verify-remote':
		if (args.length !== 1)
			fail(
				'usage : verify-remote <manifeste> --base <url> [--socks5 <hôte:port>] [--page <chemin>]...'
			);
		await verifyRemote(args[0], values);
		break;
	default:
		fail('commande attendue : generate, compare ou verify-remote');
}
