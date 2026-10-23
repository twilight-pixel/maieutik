import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..');

// Lance un script et renvoie { code, stdout, stderr } sans lever sur un code non nul.
export function run(script, args) {
	return new Promise((resolve) => {
		execFile(process.execPath, [join(SCRIPTS, script), ...args], (error, stdout, stderr) => {
			resolve({ code: error ? error.code : 0, stdout, stderr });
		});
	});
}

// Crée un dossier temporaire à partir d'un objet { 'chemin/relatif': contenu }.
export async function tree(files) {
	const root = await mkdtemp(join(tmpdir(), 'maieutik-ci-'));
	for (const [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}
