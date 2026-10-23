import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { join } from 'node:path';
import { test } from 'node:test';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { run, tree } from './helpers.mjs';

const manifest = (...args) => run('client-manifest.mjs', args);
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

const CLIENT = {
	'_app/immutable/start.js': 'export const start = 1;',
	'_app/immutable/app.css': 'body{margin:0}',
	'favicon.svg': '<svg/>'
};

async function generate(files, version = 'v1.0.0') {
	const dir = await tree(files);
	const out = join(dir, '..', `${sha256(dir).slice(0, 8)}-manifest.json`);
	const res = await manifest('generate', dir, '--version', version, '--out', out);
	assert.equal(res.code, 0, res.stderr);
	return { dir, out, json: JSON.parse(await readFile(out, 'utf8')) };
}

test('generate : racine compatible avec sha256sum, chemins triés', async () => {
	const { json } = await generate(CLIENT);
	const paths = Object.keys(json.files);
	assert.deepEqual(paths, [...paths].sort());
	assert.equal(json.files['favicon.svg'], sha256('<svg/>'));
	const listing = paths.map((p) => `${json.files[p]}  ${p}\n`).join('');
	assert.equal(json.root, sha256(listing));
	assert.equal(json.version, 'v1.0.0');
});

test('compare : builds identiques puis différents', async () => {
	const a = await generate(CLIENT);
	const b = await generate(CLIENT);
	assert.equal((await manifest('compare', a.out, b.out)).code, 0);

	const c = await generate({
		...CLIENT,
		'_app/immutable/start.js': 'export const start = Date.now();'
	});
	const res = await manifest('compare', a.out, c.out);
	assert.equal(res.code, 1);
	assert.match(res.stderr, /~ _app\/immutable\/start\.js/);
});

test('compare : refuse un manifeste dont la racine a été modifiée', async () => {
	const a = await generate(CLIENT);
	const forged = {
		...a.json,
		files: { ...a.json.files, 'favicon.svg': sha256('<svg onload=x/>') }
	};
	await writeFile(a.out, JSON.stringify(forged));
	const res = await manifest('compare', a.out, a.out);
	assert.equal(res.code, 2);
	assert.match(res.stderr, /racine incohérente/);
});

// Serveur minimal qui imite adapter-node : variantes .br/.gz précompressées, négociées.
async function serve(dir, { root, tamperBrotli = false, extraScript } = {}) {
	const server = http.createServer(async (req, res) => {
		const path = decodeURIComponent(new URL(req.url, 'http://x').pathname.slice(1));
		if (path === '.well-known/maieutik/build.json') {
			res.setHeader('content-type', 'application/json');
			return res.end(JSON.stringify({ version: 'v1.0.0', root }));
		}
		if (path === '') {
			res.setHeader('content-type', 'text/html');
			return res.end(`<!doctype html><link rel="stylesheet" href="./_app/immutable/app.css">
<script type="module" src="./_app/immutable/start.js"></script>${extraScript ?? ''}`);
		}
		let body;
		try {
			body = await readFile(join(dir, path));
		} catch {
			res.statusCode = 404;
			return res.end();
		}
		const accept = req.headers['accept-encoding'] ?? '';
		if (accept.includes('br')) {
			res.setHeader('content-encoding', 'br');
			return res.end(brotliCompressSync(tamperBrotli ? Buffer.from('alert("piégé")') : body));
		}
		if (accept.includes('gzip')) {
			res.setHeader('content-encoding', 'gzip');
			return res.end(gzipSync(body));
		}
		res.end(body);
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	return { server, base: `http://127.0.0.1:${server.address().port}/` };
}

test('verify-remote : contenu conforme sous chaque encodage', async () => {
	const { dir, out, json } = await generate(CLIENT);
	const { server, base } = await serve(dir, { root: json.root });
	try {
		const res = await manifest('verify-remote', out, '--base', base, '--page', '/');
		assert.equal(res.code, 0, res.stderr);
		assert.match(res.stdout, /9 réponses conformes/);
	} finally {
		server.close();
	}
});

test('verify-remote : détecte une variante brotli altérée', async () => {
	const { dir, out, json } = await generate(CLIENT);
	const { server, base } = await serve(dir, { root: json.root, tamperBrotli: true });
	try {
		const res = await manifest('verify-remote', out, '--base', base);
		assert.equal(res.code, 1);
		assert.match(res.stderr, /start\.js \[br\] : contenu différent/);
		assert.doesNotMatch(res.stderr, /\[gzip\]/);
	} finally {
		server.close();
	}
});

test('verify-remote : détecte une racine annoncée différente et un script inconnu', async () => {
	const { dir, out } = await generate(CLIENT);
	const { server, base } = await serve(dir, {
		root: sha256('autre'),
		extraScript:
			'<script src="/_app/immutable/injecte.js"></script><script src="https://evil.example/x.js"></script>'
	});
	try {
		const res = await manifest('verify-remote', out, '--base', base, '--page', '/');
		assert.equal(res.code, 1);
		assert.match(res.stderr, /build\.json : racine/);
		assert.match(res.stderr, /injecte\.js absent du manifeste/);
		assert.match(res.stderr, /script ou style externe https:\/\/evil\.example\/x\.js/);
	} finally {
		server.close();
	}
});
