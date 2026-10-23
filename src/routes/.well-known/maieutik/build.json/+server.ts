import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { RequestHandler } from './$types';

/**
 * Version et racine du manifeste du code client servi (D12). Le fichier est produit
 * par le Dockerfile ; il est absent en développement.
 */
interface BuildInfo {
	version: string | null;
	root: string | null;
}

let cached: Promise<BuildInfo> | undefined;

async function loadBuildInfo(): Promise<BuildInfo> {
	try {
		const manifest = JSON.parse(
			await readFile(resolve('build/client-manifest.json'), 'utf-8')
		) as Partial<BuildInfo>;
		return { version: manifest.version ?? null, root: manifest.root ?? null };
	} catch {
		return { version: null, root: null };
	}
}

export const GET: RequestHandler = async () => {
	cached ??= loadBuildInfo();
	return Response.json(await cached, { headers: { 'cache-control': 'no-store' } });
};
