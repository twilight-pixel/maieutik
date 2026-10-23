/**
 * Confort de lecture : taille du texte, largeur de la colonne, interligne.
 *
 * Même principe que le thème (theme.svelte.ts) : le choix est gardé dans localStorage, jamais
 * dans un cookie, et posé sur <html> en attributs data-* que app.css traduit en variables.
 * static/theme-init.js les relit avant le premier affichage, pour éviter un saut de mise en page.
 * Sans JavaScript ou sans choix, les valeurs par défaut s'appliquent.
 */
export const TEXT_SIZES = ['s', 'm', 'l', 'xl'] as const;
export const MEASURES = ['narrow', 'normal', 'wide'] as const;
export const LEADINGS = ['tight', 'normal', 'loose'] as const;

export type TextSize = (typeof TEXT_SIZES)[number];
export type Measure = (typeof MEASURES)[number];
export type Leading = (typeof LEADINGS)[number];

export type ReadingView = { size: TextSize; measure: Measure; leading: Leading };

export const DEFAULT_VIEW: ReadingView = { size: 'm', measure: 'normal', leading: 'normal' };

const KEY = 'maieutik-view';

/** Attribut de <html> pour chaque réglage ; absent quand la valeur est celle par défaut. */
const ATTRIBUTES = { size: 'textSize', measure: 'measure', leading: 'leading' } as const;
const CHOICES = { size: TEXT_SIZES, measure: MEASURES, leading: LEADINGS } as const;

export const view = $state<ReadingView>({ ...DEFAULT_VIEW });

function apply(): void {
	const dataset = document.documentElement.dataset;
	for (const field of Object.keys(ATTRIBUTES) as (keyof ReadingView)[]) {
		if (view[field] === DEFAULT_VIEW[field]) delete dataset[ATTRIBUTES[field]];
		else dataset[ATTRIBUTES[field]] = view[field];
	}
}

/** Lit l'état posé par theme-init.js : à appeler une fois au montage. */
export function initView(): void {
	const dataset = document.documentElement.dataset;
	for (const field of Object.keys(ATTRIBUTES) as (keyof ReadingView)[]) {
		const value = dataset[ATTRIBUTES[field]];
		(view as Record<string, string>)[field] = (CHOICES[field] as readonly string[]).includes(
			value ?? ''
		)
			? (value as string)
			: DEFAULT_VIEW[field];
	}
}

function save(): void {
	try {
		const changed = Object.fromEntries(
			Object.entries(view).filter(
				([field, value]) => value !== DEFAULT_VIEW[field as keyof ReadingView]
			)
		);
		if (Object.keys(changed).length === 0) localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, JSON.stringify(changed));
	} catch {
		// Stockage indisponible (Tor Browser) : le réglage vaut pour cette page.
	}
}

export function setView<K extends keyof ReadingView>(field: K, value: ReadingView[K]): void {
	view[field] = value;
	apply();
	save();
}

export function resetView(): void {
	Object.assign(view, DEFAULT_VIEW);
	apply();
	save();
}
