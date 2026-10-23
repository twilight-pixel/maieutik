/**
 * Thème clair, sépia ou sombre. Sans choix, la préférence du système s'applique (CSS pur).
 * Le choix est gardé dans localStorage, jamais dans un cookie : il ne quitte pas le
 * navigateur. Si le stockage est indisponible (Tor Browser), il vaut pour la page seulement.
 * Le script static/theme-init.js le relit avant le premier affichage.
 */
export type Theme = 'light' | 'sepia' | 'dark';
/** Choix de l'utilisateur : un thème, ou « selon l'appareil ». */
export type ThemeChoice = Theme | 'auto';

export const THEMES: readonly Theme[] = ['light', 'sepia', 'dark'];

const KEY = 'maieutik-theme';

const query = () => window.matchMedia('(prefers-color-scheme: dark)');

const isTheme = (value: unknown): value is Theme => THEMES.includes(value as Theme);

function stored(): Theme | null {
	try {
		const value = localStorage.getItem(KEY);
		return isTheme(value) ? value : null;
	} catch {
		return null;
	}
}

/**
 * `current` : thème effectivement affiché (null avant le montage, côté serveur).
 * `choice` : réglage de l'utilisateur, « auto » tant qu'il n'a rien choisi.
 */
export const theme = $state<{ current: Theme | null; choice: ThemeChoice }>({
	current: null,
	choice: 'auto'
});

/** Thème effectivement affiché, le choix explicite l'emportant sur le système. */
function effective(): Theme {
	const set = document.documentElement.dataset.theme;
	if (isTheme(set)) return set;
	return query().matches ? 'dark' : 'light';
}

/** À appeler une fois au montage : lit l'état posé par theme-init.js. Retourne un nettoyeur. */
export function initTheme(): () => void {
	theme.current = effective();
	theme.choice = isTheme(document.documentElement.dataset.theme)
		? (document.documentElement.dataset.theme as Theme)
		: 'auto';
	const media = query();
	const onChange = () => {
		if (!stored() && !document.documentElement.dataset.theme) theme.current = effective();
	};
	media.addEventListener('change', onChange);
	return () => media.removeEventListener('change', onChange);
}

/** Applique un choix : « auto » retire le réglage et rend la main au système. */
export function setTheme(choice: ThemeChoice): void {
	if (choice === 'auto') delete document.documentElement.dataset.theme;
	else document.documentElement.dataset.theme = choice;
	theme.choice = choice;
	theme.current = effective();
	try {
		if (choice === 'auto') localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, choice);
	} catch {
		// Stockage indisponible : le choix vaut pour cette page.
	}
}

/** Bascule rapide de l'en-tête : du sombre vers le clair, de tout autre thème vers le sombre. */
export function toggleTheme(): void {
	setTheme(effective() === 'dark' ? 'light' : 'dark');
}
