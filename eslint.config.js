import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	// Cas de test Semgrep : contiennent volontairement du code interdit.
	{ ignores: ['.semgrep/'] },
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		// Code isomorphe (D13) : exécuté à l'identique dans le navigateur et sur le serveur,
		// extractible tel quel en paquet. Aucune dépendance au framework ni à Node.
		files: ['src/lib/shared/**/*.ts'],
		ignores: ['src/lib/shared/**/*.spec.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							regex: '^([$]app/|[$]env/|#lib/(?!shared/)|node:|svelte)',
							message: 'src/lib/shared doit rester isomorphe et indépendant du framework (D13).'
						},
						{
							regex: '^[.][.]/',
							message: 'src/lib/shared ne doit importer que dans son propre dossier (D13).'
						}
					]
				}
			]
		}
	},
	{
		rules: {
			// Les liens internes passent par href() de src/lib/href.ts, qui appelle resolve() :
			// la règle ne suit pas cet appel indirect.
			'svelte/no-navigation-without-resolve': ['error', { ignoreLinks: true, ignoreGoto: true }],
			// Anonymat dans l'architecture (docs/03) : l'adresse IP ne doit jamais être lue.
			'no-restricted-properties': [
				'error',
				{
					property: 'getClientAddress',
					message: 'Interdit : la plateforme ne lit ni ne conserve aucune adresse IP (docs/03).'
				}
			],
			'no-restricted-syntax': [
				'error',
				{
					selector: 'Literal[value=/^(x-forwarded-for|x-real-ip|cf-connecting-ip|forwarded)$/i]',
					message: 'Interdit : en-tête porteur d’adresse IP (docs/03).'
				}
			]
		}
	},
	{
		// Requêtes témoins : envoient volontairement des en-têtes IP pour prouver qu'ils ne sont
		// ni lus ni stockés (docs/10).
		files: ['tests/**/*.canary.ts'],
		rules: { 'no-restricted-syntax': 'off' }
	}
);
