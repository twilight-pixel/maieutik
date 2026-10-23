/**
 * Rappel des votes de juré en attente (D18). Pour ne pas relier la navigation d'un lecteur à
 * son pseudonyme, la vérification (requête signée) n'a lieu que pour un volontaire déclaré
 * sur cet appareil, et au plus une fois par session de navigation.
 */
const VOLUNTEER = (key: string) => `maieutik:jury-volunteer:${key}`;
const PENDING = (key: string) => `maieutik:jury-pending:${key}`;

function read(storage: () => Storage, name: string): string | null {
	try {
		return storage().getItem(name);
	} catch {
		return null;
	}
}

function write(storage: () => Storage, name: string, value: string | null): void {
	try {
		if (value === null) storage().removeItem(name);
		else storage().setItem(name, value);
	} catch {
		// Stockage indisponible (Tor Browser, navigation privée) : pas de rappel.
	}
}

export function markVolunteer(key: string, volunteer: boolean): void {
	write(() => localStorage, VOLUNTEER(key), volunteer ? '1' : null);
	write(() => sessionStorage, PENDING(key), null);
}

export const isVolunteer = (key: string): boolean =>
	read(() => localStorage, VOLUNTEER(key)) === '1';

/** Nombre de votes en attente déjà vérifié pendant cette session, ou null. */
export function cachedPending(key: string): number | null {
	const value = read(() => sessionStorage, PENDING(key));
	return value === null ? null : Number(value);
}

export function storePending(key: string, count: number): void {
	write(() => sessionStorage, PENDING(key), String(count));
}
