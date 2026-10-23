#!/usr/bin/env node
// Invariant I3 : aucune page ne charge de ressource depuis une autre origine.
// Une police, une image ou un script externe divulgue l'adresse IP du lecteur (docs/03, docs/09).
//
//   check-external-resources.mjs <dossier>... [--forbid-host <hôte>]...
//
// Analyse les fichiers HTML, SVG et CSS : sortie de build et pages capturées par les tests E2E.
// Le JavaScript n'est pas analysé ici : la CSP et le test réseau Playwright le couvrent.
// --forbid-host signale aussi les liens absolus vers le site lui-même, qui cassent l'accès onion.

import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { parseArgs } from 'node:util';

const SCANNED = new Set(['.html', '.htm', '.svg', '.css']);
const RESOURCE_ATTRS = new Set([
	'src',
	'srcset',
	'imagesrcset',
	'poster',
	'data',
	'action',
	'formaction',
	'background',
	'manifest',
	'ping'
]);
const HREF_IS_RESOURCE = new Set(['link', 'base', 'use', 'image', 'feimage', 'script']);
const NAVIGATION_TAGS = new Set(['a', 'area']);
const SAFE_RESOURCE_SCHEMES = new Set(['data', 'blob']);

const { positionals: dirs, values } = parseArgs({
	allowPositionals: true,
	options: { 'forbid-host': { type: 'string', multiple: true, default: [] } }
});
if (dirs.length === 0) {
	console.error('usage : check-external-resources.mjs <dossier>... [--forbid-host <hôte>]...');
	process.exit(2);
}
const forbiddenHosts = new Set(values['forbid-host'].map((h) => h.toLowerCase()));

// Remplace une plage par des espaces en gardant les retours à la ligne, pour conserver les numéros de ligne.
const blank = (s) => s.replace(/[^\n]/g, ' ');

const decodeEntities = (s) =>
	s
		.replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
		.replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(Number(d)))
		.replace(/&colon;/gi, ':')
		.replace(/&sol;/gi, '/')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');

function classify(rawUrl) {
	const url = decodeEntities(rawUrl).trim();
	if (url.startsWith('//'))
		return { kind: 'external', host: url.slice(2).split(/[/?#]/)[0].toLowerCase() };
	const scheme = url.match(/^([a-z][a-z0-9+.-]*):/i)?.[1].toLowerCase();
	if (!scheme) return { kind: 'relative' };
	if (scheme === 'javascript') return { kind: 'javascript' };
	if (SAFE_RESOURCE_SCHEMES.has(scheme)) return { kind: 'inline' };
	if (scheme === 'http' || scheme === 'https') {
		try {
			return { kind: 'external', host: new URL(url).hostname.toLowerCase() };
		} catch {
			return { kind: 'external', host: '?' };
		}
	}
	return { kind: 'other', scheme };
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

function checkCss(css, offset, source, report) {
	const clean = css.replace(/\/\*[\s\S]*?\*\//g, blank);
	const patterns = [
		/@import\s+(?:url\(\s*)?(['"]?)([^'")\s;]+)\1/g,
		/url\(\s*(['"]?)([^'")]+?)\1\s*\)/g
	];
	for (const re of patterns) {
		for (const m of clean.matchAll(re)) {
			const { kind, host } = classify(m[2]);
			if (kind === 'external')
				report(lineAt(source, offset + m.index), `ressource CSS externe : ${m[2]}`, host);
		}
	}
}

function checkHtml(html, report) {
	// Ni les commentaires ni le contenu des scripts ne chargent de ressource : les données
	// d'hydratation contiennent des URL de sources citées, qui ne sont que du texte.
	let text = html.replace(/<!--[\s\S]*?-->/g, blank);
	text = text.replace(
		/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,
		(_, open, body, close) => open + blank(body) + close
	);

	for (const m of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
		checkCss(m[1], m.index + m[0].indexOf(m[1]), text, report);
	}

	const tagRe =
		/<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
	const attrRe = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

	for (const tag of text.matchAll(tagRe)) {
		const name = tag[1].toLowerCase();
		const line = lineAt(text, tag.index);
		const attrs = new Map();
		for (const a of (tag[2] ?? '').matchAll(attrRe))
			attrs.set(a[1].toLowerCase(), a[2] ?? a[3] ?? a[4] ?? '');

		for (const [attr, value] of attrs) {
			const isHref = attr === 'href' || attr === 'xlink:href';
			const urls =
				attr === 'srcset' || attr === 'imagesrcset'
					? value.split(',').map((c) => c.trim().split(/\s+/)[0])
					: [value];

			for (const url of urls.filter(Boolean)) {
				const { kind, host } = classify(url);
				if (kind === 'javascript') report(line, `URL javascript: dans <${name} ${attr}>`);
				if (kind !== 'external') continue;

				if (RESOURCE_ATTRS.has(attr) || (isHref && HREF_IS_RESOURCE.has(name))) {
					report(line, `ressource externe <${name} ${attr}="${url}">`, host);
				} else if (isHref && NAVIGATION_TAGS.has(name)) {
					const rel = (attrs.get('rel') ?? '').toLowerCase().split(/\s+/);
					if (!rel.includes('noreferrer'))
						report(line, `lien externe sans rel="noreferrer" : ${url}`);
					if (forbiddenHosts.has(host))
						report(line, `lien absolu vers le site lui-même (casse l'accès onion) : ${url}`);
				}
			}
		}

		if (name === 'meta' && (attrs.get('http-equiv') ?? '').toLowerCase() === 'refresh') {
			const target = (attrs.get('content') ?? '').match(/url\s*=\s*['"]?([^'"]+)/i)?.[1];
			if (target && classify(target).kind === 'external')
				report(line, `redirection meta externe : ${target}`);
		}
		if (attrs.has('style')) {
			checkCss(attrs.get('style'), tag.index, text, (l, msg, host) => report(line, msg, host));
		}
	}
}

async function* walk(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(path);
		else if (SCANNED.has(extname(entry.name).toLowerCase())) yield path;
	}
}

const findings = [];
let scanned = 0;

for (const dir of dirs) {
	try {
		for await (const file of walk(dir)) {
			scanned++;
			const content = await readFile(file, 'utf8');
			const report = (line, message, host) => {
				const self =
					host && forbiddenHosts.has(host) ? ' (site lui-même : utiliser un lien relatif)' : '';
				findings.push(`${file}:${line}: ${message}${self}`);
			};
			if (extname(file).toLowerCase() === '.css') checkCss(content, 0, content, report);
			else checkHtml(content, report);
		}
	} catch (e) {
		console.error(`erreur : ${dir} : ${e.message}`);
		process.exit(2);
	}
}

if (scanned === 0) {
	console.error(`erreur : aucun fichier HTML, SVG ou CSS dans ${dirs.join(', ')}`);
	process.exit(2);
}
if (findings.length > 0) {
	console.error(`${findings.length} problème(s) dans ${scanned} fichier(s) :`);
	for (const f of findings) console.error(`  ${f}`);
	process.exit(1);
}
console.log(`OK : ${scanned} fichier(s), aucune ressource externe.`);
