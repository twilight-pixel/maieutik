import { resolve } from '$app/paths';
import { localizeHref } from '#lib/paraglide/runtime.js';

/**
 * Lien interne : chemin localisé (langue portée par l'URL) et résolu par SvelteKit.
 * Toujours relatif à l'origine, jamais absolu (accès onion, docs/08).
 *
 * L'union des routes typées de SvelteKit dépasse ce que TypeScript sait comparer :
 * la signature est donc élargie à `string` ici, en un seul endroit.
 */
export function href(path: string, options?: Parameters<typeof localizeHref>[1]): string {
	return (resolve as (pathname: string) => string)(localizeHref(path, options));
}
