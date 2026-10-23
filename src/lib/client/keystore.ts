/**
 * Stockage local du navigateur (IndexedDB) pour le coffre chiffré et la clé de l'appareil.
 * Dans Tor Browser ou en navigation privée, IndexedDB peut être absent ou effacé à la
 * fermeture : l'identité vit alors seulement en mémoire (D06, ajustement D10).
 */
const DB_NAME = 'maieutik';
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
	dbPromise ??= new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
	return dbPromise;
}

function run<T>(
	mode: IDBTransactionMode,
	action: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
	return open().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const request = action(db.transaction(STORE, mode).objectStore(STORE));
				request.onsuccess = () => resolve(request.result as T);
				request.onerror = () => reject(request.error);
			})
	);
}

export const keystore = {
	async available(): Promise<boolean> {
		try {
			await open();
			return true;
		} catch {
			return false;
		}
	},
	get<T>(key: string): Promise<T | undefined> {
		return run<T | undefined>('readonly', (store) => store.get(key));
	},
	set(key: string, value: unknown): Promise<void> {
		return run<void>('readwrite', (store) => store.put(value, key));
	},
	delete(key: string): Promise<void> {
		return run<void>('readwrite', (store) => store.delete(key));
	},
	/** Demande au navigateur de ne pas effacer le stockage sous pression d'espace. */
	async persist(): Promise<boolean> {
		try {
			return (await navigator.storage?.persist?.()) ?? false;
		} catch {
			return false;
		}
	}
};
