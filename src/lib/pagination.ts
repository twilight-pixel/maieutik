/** Numéro de page lu dans l'URL (`?page=`), 1 par défaut. */
export function pageFrom(url: URL, param = 'page'): number {
	const page = Number(url.searchParams.get(param));
	return Number.isInteger(page) && page > 1 && page < 10_000 ? page : 1;
}

/**
 * Charge une page en demandant un élément de plus que la taille : sa présence indique
 * qu'une page suivante existe, sans compter tout le reste.
 */
export async function paginate<T>(
	page: number,
	size: number,
	fetch: (limit: number, offset: number) => Promise<T[]>
): Promise<{ items: T[]; page: number; hasNext: boolean }> {
	const rows = await fetch(size + 1, (page - 1) * size);
	return { items: rows.slice(0, size), page, hasNext: rows.length > size };
}
