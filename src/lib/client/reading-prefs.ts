/**
 * Préférences de lecture des avertissements (docs/06) : afficher, replier ou masquer chaque
 * catégorie. Conservées dans le stockage local du navigateur, jamais envoyées au serveur.
 */
import { CONTENT_WARNINGS, type ContentWarning } from '#lib/shared/content.js';

export type WarningMode = 'show' | 'blur' | 'hide';
export type ReadingPrefs = Record<ContentWarning, WarningMode>;

const STORAGE_KEY = 'maieutik:reading-prefs';
const MODES: WarningMode[] = ['show', 'blur', 'hide'];

export const defaultPrefs = (): ReadingPrefs =>
	Object.fromEntries(CONTENT_WARNINGS.map((w) => [w, 'blur'])) as ReadingPrefs;

export function loadPrefs(): ReadingPrefs {
	const prefs = defaultPrefs();
	try {
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;
		for (const warning of CONTENT_WARNINGS) {
			const mode = stored[warning];
			if (typeof mode === 'string' && (MODES as string[]).includes(mode)) {
				prefs[warning] = mode as WarningMode;
			}
		}
	} catch {
		// Stockage indisponible (navigation privée, Tor Browser) : réglages par défaut.
	}
	return prefs;
}

export function savePrefs(prefs: ReadingPrefs): boolean {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
		return true;
	} catch {
		return false;
	}
}

/** Mode le plus restrictif parmi les avertissements d'un texte. */
export function modeFor(warnings: ContentWarning[], prefs: ReadingPrefs): WarningMode {
	const modes = warnings.map((w) => prefs[w]);
	return modes.includes('hide') ? 'hide' : modes.includes('blur') ? 'blur' : 'show';
}
