#!/usr/bin/env node
// Invariant I2 : Caddy ne journalise ni les requêtes ni les adresses IP (docs/03, docs/09).
//
//   check-caddy-config.mjs <Caddyfile>...
//
// Règles :
//   1. Le bloc d'options globales discarde tous les journaux (`log { output discard }`) :
//      les journaux d'erreur par défaut contiennent l'adresse du client.
//   2. Aucun `log`, `log_append` ou `log_name` dans un bloc de site ou un snippet.
//   3. Chaque `reverse_proxy` retire X-Forwarded-For, que Caddy ajoute par défaut.
//   4. Pas d'option globale `email` : le compte ACME serait lié à l'identité d'un opérateur (D02).
//   5. Tout bloc qui contient un `reverse_proxy` répond `respond /internal* 404` : l'interface
//      du robot d'archivage n'est jamais exposée (D15).

import { readFile } from 'node:fs/promises';

const SITE_LOG_DIRECTIVES = new Set(['log', 'log_append', 'log_name']);

function tokenize(source) {
	const lines = [];
	source.split(/\r?\n/).forEach((raw, i) => {
		const tokens = [];
		let j = 0;
		while (j < raw.length) {
			const c = raw[j];
			if (/\s/.test(c)) {
				j++;
			} else if (c === '#') {
				break;
			} else if (c === '"' || c === '`') {
				let k = j + 1;
				let text = '';
				while (k < raw.length && raw[k] !== c) {
					if (c === '"' && raw[k] === '\\' && k + 1 < raw.length) k++;
					text += raw[k++];
				}
				tokens.push({ text, quoted: true });
				j = k + 1;
			} else {
				let k = j;
				while (k < raw.length && !/\s/.test(raw[k])) k++;
				tokens.push({ text: raw.slice(j, k), quoted: false });
				j = k;
			}
		}
		if (tokens.length > 0) lines.push({ tokens, line: i + 1 });
	});
	return lines;
}

function parse(source) {
	const root = { words: [], children: [], line: 0 };
	const stack = [root];
	for (const { tokens, line } of tokenize(source)) {
		if (tokens.length === 1 && !tokens[0].quoted && tokens[0].text === '}') {
			if (stack.length === 1) throw new Error(`ligne ${line} : accolade fermante sans ouverture`);
			stack.pop();
			continue;
		}
		const last = tokens.at(-1);
		const opens = !last.quoted && last.text === '{';
		const node = {
			words: (opens ? tokens.slice(0, -1) : tokens).map((t) => t.text),
			children: [],
			line
		};
		stack.at(-1).children.push(node);
		if (opens) stack.push(node);
	}
	if (stack.length !== 1) throw new Error('accolades non équilibrées');
	return root;
}

function* descendants(node) {
	for (const child of node.children) {
		yield child;
		yield* descendants(child);
	}
}

function check(source) {
	const errors = [];
	const root = parse(source);
	const [first, ...rest] = root.children;
	const global = first && first.words.length === 0 ? first : null;
	const sites = global ? rest : root.children;

	if (!global) {
		errors.push("bloc d'options globales absent : ajouter `{ log { output discard } }` en tête");
	} else {
		const logs = global.children.filter((n) => n.words[0] === 'log');
		if (logs.length === 0)
			errors.push(`ligne ${global.line} : options globales sans \`log { output discard }\``);
		for (const log of logs) {
			const discard = log.children.some((n) => n.words[0] === 'output' && n.words[1] === 'discard');
			if (!discard) errors.push(`ligne ${log.line} : journal global sans \`output discard\``);
		}
		for (const email of global.children.filter((n) => n.words[0] === 'email')) {
			errors.push(
				`ligne ${email.line} : option \`email\` : le compte ACME serait lié à un opérateur`
			);
		}
	}

	for (const site of sites) {
		for (const block of [site, ...descendants(site)]) {
			const proxy = block.children.find((n) => n.words[0] === 'reverse_proxy');
			const hidesInternal = block.children.some(
				(n) => n.words[0] === 'respond' && n.words[1] === '/internal*' && n.words[2] === '404'
			);
			if (proxy && !hidesInternal) {
				errors.push(`ligne ${proxy.line} : reverse_proxy sans \`respond /internal* 404\` à côté`);
			}
		}
		for (const node of descendants(site)) {
			if (SITE_LOG_DIRECTIVES.has(node.words[0])) {
				errors.push(
					`ligne ${node.line} : directive \`${node.words[0]}\` interdite (aucun journal d'accès)`
				);
			}
			if (node.words[0] === 'reverse_proxy') {
				const strips = node.children.some(
					(n) => n.words[0] === 'header_up' && n.words[1]?.toLowerCase() === '-x-forwarded-for'
				);
				if (!strips)
					errors.push(`ligne ${node.line} : reverse_proxy sans \`header_up -X-Forwarded-For\``);
			}
		}
	}
	return errors;
}

const files = process.argv.slice(2);
if (files.length === 0) {
	console.error('usage : check-caddy-config.mjs <Caddyfile>...');
	process.exit(2);
}

let failed = false;
for (const file of files) {
	let errors;
	try {
		errors = check(await readFile(file, 'utf8'));
	} catch (e) {
		errors = [e.message];
	}
	if (errors.length > 0) {
		failed = true;
		console.error(`${file} :`);
		for (const e of errors) console.error(`  ${e}`);
	} else {
		console.log(`OK : ${file}`);
	}
}
process.exit(failed ? 1 : 0);
