/**
 * Reprise de lecture des textes longs : où l'on s'est arrêté, gardé dans ce navigateur.
 *
 * Ce n'est qu'un repère local (identifiant du texte, avancement en pourcentage) : il n'est
 * jamais envoyé au serveur et ne contient ni date ni heure. Il n'est écrit que pour les textes
 * longs, limité aux derniers consultés, et disparaît avec les données du site. Si le stockage
 * est indisponible (Tor Browser), la fonction est simplement absente.
 */
const KEY = 'maieutik-reading';
const MAX_ENTRIES = 20;

/** En dessous, on recommence au début : pas de repère utile. */
export const RESUME_MIN = 0.03;
/** Au-dessus, le texte est considéré comme lu. */
export const RESUME_DONE = 0.97;

type Entries = Record<string, number>;

function read(): Entries {
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
		return Object.fromEntries(
			Object.entries(parsed).filter(
				(entry): entry is [string, number] => typeof entry[1] === 'number'
			)
		);
	} catch {
		return {};
	}
}

function write(entries: Entries): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(entries));
	} catch {
		// Stockage indisponible ou plein : pas de repère, la lecture n'en souffre pas.
	}
}

export function getPosition(id: string): number | null {
	const ratio = read()[id];
	return ratio !== undefined && ratio >= RESUME_MIN && ratio < RESUME_DONE ? ratio : null;
}

export function forgetPosition(id: string): void {
	const entries = read();
	if (!(id in entries)) return;
	delete entries[id];
	write(entries);
}

/** Enregistre l'avancement ; un texte terminé ou à peine commencé est oublié. */
export function savePosition(id: string, ratio: number): void {
	if (ratio < RESUME_MIN || ratio >= RESUME_DONE) return forgetPosition(id);
	const entries = read();
	// Le plus récent en dernier : on retire l'ancienne entrée avant de la réinsérer.
	delete entries[id];
	entries[id] = Math.round(ratio * 100) / 100;
	const keys = Object.keys(entries);
	for (const old of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) delete entries[old];
	write(entries);
}
