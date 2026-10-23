import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run, tree } from './helpers.mjs';

const check = (dir, ...args) => run('check-external-resources.mjs', [dir, ...args]);

test('accepte des pages sans ressource externe', async () => {
	const dir = await tree({
		'index.html': `<!doctype html>
<link rel="stylesheet" href="./_app/app.css">
<script type="module" src="./_app/start.js"></script>
<img src="/media/a.webp" srcset="/media/a-2x.webp 2x" alt="">
<img src="data:image/png;base64,AAAA" alt="">
<a href="https://fr.wikipedia.org/wiki/Hypatie" rel="noreferrer noopener">source</a>
<a href="mailto:contact@example.org">contact</a>
<!-- <img src="https://commentaire.example"> -->
<script>const data = { source: "https://archive.org/details/x" };</script>`,
		'_app/app.css': `@font-face { src: url("/fonts/inter.woff2"); } /* url(https://x.example/y) */`,
		'icon.svg': `<svg xmlns="http://www.w3.org/2000/svg"><use href="#a"/></svg>`
	});
	const { code, stdout } = await check(dir);
	assert.equal(code, 0, stdout);
	assert.match(stdout, /3 fichier/);
});

test('signale chaque type de ressource externe', async () => {
	const dir = await tree({
		'page.html': `<!doctype html>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
<link rel="preconnect" href="https://cdn.example.com">
<script src="//cdn.example.com/lib.js"></script>
<img src="https://images.example.com/a.png" alt="">
<img srcset="/a.png 1x, https://images.example.com/a2.png 2x" alt="">
<video poster="https&#58;//videos.example.com/p.jpg"></video>
<form action="https://collect.example.com/"></form>
<div style="background: url('https://bg.example.com/x.png')"></div>
<style>@import url("https://css.example.com/x.css");</style>
<meta http-equiv="refresh" content="0; url=https://ailleurs.example.com/">
<a href="javascript:alert(1)">x</a>
<a href="https://wikipedia.org/">sans noreferrer</a>`,
		'style.css': `body { background: url(https://tracker.example.com/p.gif); }`,
		'logo.svg': `<svg xmlns="http://www.w3.org/2000/svg"><image href="https://img.example.com/x.png"/></svg>`
	});
	const { code, stderr } = await check(dir);
	assert.equal(code, 1);
	for (const expected of [
		'page.html:2: ressource externe <link href',
		'page.html:3: ressource externe <link href',
		'page.html:4: ressource externe <script src',
		'page.html:5: ressource externe <img src',
		'page.html:6: ressource externe <img srcset',
		'page.html:7: ressource externe <video poster',
		'page.html:8: ressource externe <form action',
		'page.html:9: ressource CSS externe',
		'page.html:10: ressource CSS externe',
		'page.html:11: redirection meta externe',
		'page.html:12: URL javascript:',
		'page.html:13: lien externe sans rel="noreferrer"',
		'style.css:1: ressource CSS externe',
		'logo.svg:1: ressource externe <image href'
	]) {
		assert.ok(stderr.includes(expected), `attendu « ${expected} » dans :\n${stderr}`);
	}
});

test('--forbid-host signale les liens absolus vers le site lui-même', async () => {
	const dir = await tree({
		'index.html': `<a href="https://maieutik.example/textes/1" rel="noreferrer">lien</a>`
	});
	const { code, stderr } = await check(dir, '--forbid-host', 'maieutik.example');
	assert.equal(code, 1);
	assert.match(stderr, /lien absolu vers le site lui-même/);
});

test("échoue si aucun fichier n'est analysé", async () => {
	const dir = await tree({ 'app.js': 'console.log(1)' });
	const { code, stderr } = await check(dir);
	assert.equal(code, 2);
	assert.match(stderr, /aucun fichier/);
});
