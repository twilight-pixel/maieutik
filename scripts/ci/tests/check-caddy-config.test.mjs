import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { run, SCRIPTS, tree } from './helpers.mjs';

const check = (file) => run('check-caddy-config.mjs', [file]);

async function caddyfile(content) {
	const dir = await tree({ Caddyfile: content });
	return join(dir, 'Caddyfile');
}

const GLOBAL = `{
	log default {
		output discard
	}
}
`;

test('le Caddyfile de production respecte les règles', async () => {
	const { code, stdout, stderr } = await check(join(SCRIPTS, '../../deploy/Caddyfile'));
	assert.equal(code, 0, stderr);
	assert.match(stdout, /OK/);
});

test('exige le bloc global qui discarde les journaux', async () => {
	const { code, stderr } = await check(await caddyfile(`exemple.org {\n\trespond "ok"\n}\n`));
	assert.equal(code, 1);
	assert.match(stderr, /options globales absent/);
});

test('refuse un journal global qui écrit quelque part', async () => {
	const { code, stderr } = await check(await caddyfile(`{\n\tlog {\n\t\toutput stderr\n\t}\n}\n`));
	assert.equal(code, 1);
	assert.match(stderr, /sans `output discard`/);
});

test('refuse une directive log dans un site ou un snippet', async () => {
	const file = await caddyfile(`${GLOBAL}
(commun) {
	log
}
{$DOMAINE} {
	handle /api/* {
		log {
			output file /var/log/acces.log
		}
	}
	log_append ua {http.request.header.User-Agent}
}
`);
	const { code, stderr } = await check(file);
	assert.equal(code, 1);
	assert.equal(stderr.match(/interdite/g).length, 3, stderr);
});

test('exige le retrait de X-Forwarded-For sur chaque reverse_proxy', async () => {
	const file = await caddyfile(`${GLOBAL}
a.exemple {
	respond /internal* 404
	reverse_proxy app:3000
}
b.exemple {
	respond /internal* 404
	reverse_proxy app:3000 {
		header_up -X-Forwarded-For
	}
}
`);
	const { code, stderr } = await check(file);
	assert.equal(code, 1);
	assert.equal(stderr.match(/reverse_proxy sans/g).length, 1, stderr);
});

test("refuse l'option globale email", async () => {
	const file = await caddyfile(
		`{\n\temail operateur@example.org\n\tlog {\n\t\toutput discard\n\t}\n}\n`
	);
	const { code, stderr } = await check(file);
	assert.equal(code, 1);
	assert.match(stderr, /compte ACME/);
});

test('ne confond pas les placeholders avec des blocs', async () => {
	const file = await caddyfile(`${GLOBAL}
{$DOMAINE} {
	header Onion-Location "http://{$ONION}{uri}"
	respond "{host}"
}
`);
	const { code, stderr } = await check(file);
	assert.equal(code, 0, stderr);
});

test('exige le masquage de /internal à côté de chaque reverse_proxy', async () => {
	const file = await caddyfile(`${GLOBAL}
(proxy) {
	reverse_proxy app:3000 {
		header_up -X-Forwarded-For
	}
}
a.exemple {
	respond /internal* 404
	reverse_proxy app:3000 {
		header_up -X-Forwarded-For
	}
}
`);
	const { code, stderr } = await check(file);
	assert.equal(code, 1);
	assert.equal(stderr.match(/respond \/internal\* 404/g).length, 1, stderr);
	assert.match(stderr, /ligne 8 :/);
});
