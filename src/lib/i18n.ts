import { m } from '#lib/paraglide/messages.js';
import { getLocale } from '#lib/paraglide/runtime.js';

/** Message traduit `<préfixe>_<identifiant>` ; l'identifiant est rendu tel quel s'il manque. */
function label(prefix: string, id: string): string {
	const key = `${prefix}_${id.replaceAll(/[/-]/g, '_')}` as keyof typeof m;
	const message = m[key] as (() => string) | undefined;
	return message ? message() : id;
}

/** Libellé d'une catégorie ou sous-catégorie à partir de son identifiant stable. */
export const categoryLabel = (id: string) => label('category', id);
export const kindLabel = (id: string) => label('kind', id);
export const langLabel = (id: string) => label('lang', id);
export const warningLabel = (id: string) => label('warning', id);
export const reportCategoryLabel = (id: string) => label('report', id);
export const outcomeLabel = (id: string) => label('outcome', id);
export const originLabel = (id: string) => label('origin', id);
export const relationLabel = (id: string) => label('relation', id);
export const relationGroupLabel = (id: string) => label('relgroup', id);
export const relationShortLabel = (id: string) => label('relshort', id);
export const calloutLabel = (id: string) => label('callout', id);

/** Erreur de saisie `<préfixe>_<code>` (frise, schéma), avec le numéro de la ligne fautive. */
export function lineErrorLabel(prefix: string, code: string, line: number): string {
	const key = `${prefix}_${code.replaceAll('-', '_')}` as keyof typeof m;
	const message = m[key] as ((params: { line: number }) => string) | undefined;
	return message ? message({ line }) : code;
}

/**
 * Date au jour près (AAAA-MM-JJ) dans la langue de l'interface. Jamais d'heure (D09).
 */
export function formatDay(day: string): string {
	const [year, month, date] = day.split('-').map(Number);
	return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'long', timeZone: 'UTC' }).format(
		new Date(Date.UTC(year, month - 1, date))
	);
}
