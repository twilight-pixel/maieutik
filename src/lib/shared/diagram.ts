/**
 * Schéma : saisie sous forme de texte, et mise en page calculée (D17).
 *
 * Le bloc `diagram` ne contient que des données : une liste d'éléments et des relations
 * entre eux. Le dessin (SVG) se calcule ici, de façon déterministe, pour être identique
 * sur le serveur (lecture sans JavaScript) et dans le navigateur (aperçu de l'éditeur).
 *
 * Format de saisie, une relation par ligne : `A -> B : étiquette` (l'étiquette est facultative).
 * Un nom seul sur une ligne crée un élément sans relation.
 */
import { LIMITS, hasControl, type DiagramEdge } from './blocks';

export type DiagramData = { nodes: string[]; edges: DiagramEdge[] };

export type DiagramErrorCode =
	| 'empty'
	| 'empty-name'
	| 'forbidden'
	| 'control'
	| 'too-long'
	| 'too-many-nodes'
	| 'too-many-edges'
	| 'self-loop'
	| 'duplicate-edge';

export type DiagramParse = DiagramData & {
	/** Première erreur rencontrée ; `line` vaut 0 pour une erreur qui ne vise pas une ligne. */
	error: { line: number; code: DiagramErrorCode } | null;
};

const ARROW = '->';

export function parseDiagram(text: string): DiagramParse {
	const nodes: string[] = [];
	const edges: DiagramEdge[] = [];
	const seen = new Set<string>();
	const fail = (line: number, code: DiagramErrorCode): DiagramParse => ({
		nodes,
		edges,
		error: { line, code }
	});
	const index = (name: string) => {
		let i = nodes.indexOf(name);
		if (i === -1) i = nodes.push(name) - 1;
		return i;
	};
	const lines = text.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i].trim();
		if (raw === '') continue;
		const line = i + 1;
		if (hasControl(raw, false)) return fail(line, 'control');
		const arrow = raw.indexOf(ARROW);
		if (arrow === -1) {
			if (raw.includes(':')) return fail(line, 'forbidden');
			if (raw.length > LIMITS.maxDiagramLabel) return fail(line, 'too-long');
			index(raw);
		} else {
			const from = raw.slice(0, arrow).trim();
			const rest = raw.slice(arrow + ARROW.length);
			const colon = rest.indexOf(':');
			const to = (colon === -1 ? rest : rest.slice(0, colon)).trim();
			const label = colon === -1 ? '' : rest.slice(colon + 1).trim();
			if (from === '' || to === '') return fail(line, 'empty-name');
			if (from.includes(ARROW) || to.includes(ARROW) || from.includes(':')) {
				return fail(line, 'forbidden');
			}
			if (
				from.length > LIMITS.maxDiagramLabel ||
				to.length > LIMITS.maxDiagramLabel ||
				label.length > LIMITS.maxDiagramLabel
			) {
				return fail(line, 'too-long');
			}
			if (from === to) return fail(line, 'self-loop');
			const edge = { from: index(from), to: index(to), label };
			const key = `${edge.from}>${edge.to}`;
			if (seen.has(key)) return fail(line, 'duplicate-edge');
			seen.add(key);
			edges.push(edge);
		}
		if (nodes.length > LIMITS.maxDiagramNodes) return fail(line, 'too-many-nodes');
		if (edges.length > LIMITS.maxDiagramEdges) return fail(line, 'too-many-edges');
	}
	if (nodes.length === 0) return fail(0, 'empty');
	return { nodes, edges, error: null };
}

export function serializeDiagram(data: DiagramData): string {
	const linked = new Set<number>();
	const lines = data.edges.map((edge) => {
		linked.add(edge.from);
		linked.add(edge.to);
		const label = edge.label === '' ? '' : ` : ${edge.label}`;
		return `${data.nodes[edge.from]} ${ARROW} ${data.nodes[edge.to]}${label}`;
	});
	data.nodes.forEach((name, i) => {
		if (!linked.has(i)) lines.push(name);
	});
	return lines.join('\n');
}

// --- Mise en page --------------------------------------------------------------------------

export type DiagramBox = { x: number; y: number; width: number; height: number; lines: string[] };
export type DiagramPath = {
	path: string;
	label: string;
	labelX: number;
	labelY: number;
	/** Largeur estimée de l'étiquette, pour lui poser un fond. */
	labelWidth: number;
};
export type DiagramLayout = {
	width: number;
	height: number;
	/** Hauteur de la ligne de texte dans une boîte (pour le placement vertical du texte). */
	lineHeight: number;
	boxes: DiagramBox[];
	paths: DiagramPath[];
};

const CHAR_WIDTH = 8;
const LABEL_CHAR_WIDTH = 7;
const LINE_HEIGHT = 18;
const PAD_X = 14;
const PAD_Y = 9;
const MIN_WIDTH = 72;
const MAX_LINE_CHARS = 22;
const GAP_X = 36;
const GAP_Y = 64;
const MARGIN = 16;
const BULGE = 44;
const BULGE_STEP = 18;

const round = (n: number) => Math.round(n * 10) / 10;

/** Coupe un nom en lignes d'au plus `MAX_LINE_CHARS` caractères, aux espaces si possible. */
function wrap(text: string): string[] {
	const lines: string[] = [];
	let current = '';
	for (const word of text.split(/\s+/)) {
		let rest = word;
		while (rest.length > MAX_LINE_CHARS) {
			if (current !== '') {
				lines.push(current);
				current = '';
			}
			lines.push(rest.slice(0, MAX_LINE_CHARS));
			rest = rest.slice(MAX_LINE_CHARS);
		}
		if (current === '') current = rest;
		else if (current.length + 1 + rest.length <= MAX_LINE_CHARS) current += ` ${rest}`;
		else {
			lines.push(current);
			current = rest;
		}
	}
	if (current !== '') lines.push(current);
	return lines.length > 0 ? lines : [''];
}

/**
 * Disposition en couches, de haut en bas : une relation va d'une couche vers une couche
 * plus basse. Les relations qui reviennent en arrière (cycles) sont tracées sur le côté.
 */
export function layoutDiagram(data: DiagramData): DiagramLayout {
	const n = data.nodes.length;
	const { edges } = data;

	// 1. Couches : plus long chemin sur le graphe privé de ses arcs de retour.
	const outgoing: number[][] = Array.from({ length: n }, () => []);
	edges.forEach((edge, i) => outgoing[edge.from].push(i));
	const visit = new Array<number>(n).fill(0); // 0 : nouveau, 1 : en cours, 2 : terminé
	const back = new Set<number>();
	const dfs = (u: number) => {
		visit[u] = 1;
		for (const e of outgoing[u]) {
			const v = edges[e].to;
			if (visit[v] === 1) back.add(e);
			else if (visit[v] === 0) dfs(v);
		}
		visit[u] = 2;
	};
	for (let u = 0; u < n; u++) if (visit[u] === 0) dfs(u);

	const forward = edges.map((edge, i) => ({ ...edge, i })).filter(({ i }) => !back.has(i));
	const indegree = new Array<number>(n).fill(0);
	for (const edge of forward) indegree[edge.to]++;
	const layer = new Array<number>(n).fill(0);
	const queue = indegree.flatMap((d, u) => (d === 0 ? [u] : []));
	for (let head = 0; head < queue.length; head++) {
		const u = queue[head];
		for (const edge of forward) {
			if (edge.from !== u) continue;
			layer[edge.to] = Math.max(layer[edge.to], layer[u] + 1);
			if (--indegree[edge.to] === 0) queue.push(edge.to);
		}
	}

	// 2. Tailles des boîtes.
	const text = data.nodes.map(wrap);
	const width = text.map((lines) =>
		Math.max(MIN_WIDTH, Math.max(...lines.map((l) => l.length)) * CHAR_WIDTH + 2 * PAD_X)
	);
	const height = text.map((lines) => lines.length * LINE_HEIGHT + 2 * PAD_Y);

	// 3. Ordre dans chaque couche : barycentre des voisins, quelques passes.
	const depth = Math.max(0, ...layer);
	const rows: number[][] = Array.from({ length: depth + 1 }, () => []);
	for (let u = 0; u < n; u++) rows[layer[u]].push(u);
	const center = new Array<number>(n).fill(0);
	const place = () => {
		const rowWidth = rows.map(
			(row) => row.reduce((sum, u) => sum + width[u], 0) + GAP_X * Math.max(0, row.length - 1)
		);
		const widest = Math.max(...rowWidth);
		rows.forEach((row, r) => {
			let x = MARGIN + (widest - rowWidth[r]) / 2;
			for (const u of row) {
				center[u] = x + width[u] / 2;
				x += width[u] + GAP_X;
			}
		});
	};
	place();
	const neighbours = (u: number, direction: 'up' | 'down') =>
		forward.flatMap((e) =>
			direction === 'up' && e.to === u
				? [e.from]
				: direction === 'down' && e.from === u
					? [e.to]
					: []
		);
	const sweep = (order: number[], direction: 'up' | 'down') => {
		for (const r of order) {
			const key = new Map(
				rows[r].map((u) => {
					const near = neighbours(u, direction);
					const mean = near.length
						? near.reduce((s, v) => s + center[v], 0) / near.length
						: center[u];
					return [u, mean] as const;
				})
			);
			rows[r].sort((a, b) => key.get(a)! - key.get(b)! || a - b);
			place();
		}
	};
	const downward = rows.map((_, r) => r).slice(1);
	for (let pass = 0; pass < 3; pass++) {
		sweep(downward, 'up');
		sweep(
			[...downward].reverse().map((r) => r - 1),
			'down'
		);
	}

	// 4. Coordonnées.
	const tops: number[] = [];
	let y = MARGIN;
	rows.forEach((row, r) => {
		tops[r] = y;
		y += Math.max(...row.map((u) => height[u]), 0) + GAP_Y;
	});
	const boxes: DiagramBox[] = text.map((lines, u) => ({
		x: round(center[u] - width[u] / 2),
		y: round(tops[layer[u]]),
		width: width[u],
		height: height[u],
		lines
	}));
	const rightmost = Math.max(...boxes.map((b) => b.x + b.width));

	// 5. Relations.
	let sideCount = 0;
	let extent = rightmost;
	const paths = edges.map((edge): DiagramPath => {
		const a = boxes[edge.from];
		const b = boxes[edge.to];
		const labelWidth = edge.label.length * LABEL_CHAR_WIDTH + 8;
		if (layer[edge.to] > layer[edge.from]) {
			const x1 = a.x + a.width / 2;
			const y1 = a.y + a.height;
			const x2 = b.x + b.width / 2;
			const y2 = b.y;
			const mid = (y1 + y2) / 2;
			return {
				path: `M ${round(x1)} ${round(y1)} C ${round(x1)} ${round(mid)}, ${round(x2)} ${round(mid)}, ${round(x2)} ${round(y2)}`,
				label: edge.label,
				labelX: round((x1 + x2) / 2),
				labelY: round(mid),
				labelWidth
			};
		}
		// Retour en arrière ou même couche : par le côté droit, en s'écartant à chaque fois un peu plus.
		const x1 = a.x + a.width;
		const y1 = a.y + a.height / 2;
		const x2 = b.x + b.width;
		const y2 = b.y + b.height / 2;
		const out = Math.max(x1, x2, rightmost) + BULGE + BULGE_STEP * sideCount++;
		extent = Math.max(extent, out + labelWidth / 2);
		return {
			path: `M ${round(x1)} ${round(y1)} C ${round(out)} ${round(y1)}, ${round(out)} ${round(y2)}, ${round(x2)} ${round(y2)}`,
			label: edge.label,
			labelX: round((x1 + 6 * out + x2) / 8),
			labelY: round((y1 + y2) / 2),
			labelWidth
		};
	});

	return {
		width: round(extent + MARGIN),
		height: round(y - GAP_Y + MARGIN),
		lineHeight: LINE_HEIGHT,
		boxes,
		paths
	};
}
