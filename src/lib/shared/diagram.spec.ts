import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { LIMITS, normalizeDocument } from './blocks';
import { layoutDiagram, parseDiagram, serializeDiagram, type DiagramData } from './diagram';

describe('saisie d’un schéma', () => {
	it('crée les éléments dans l’ordre d’apparition et relie par position', () => {
		const parsed = parseDiagram('Prémisse -> Conclusion : donc\nConclusion -> Objection\nSeul');
		expect(parsed.error).toBeNull();
		expect(parsed.nodes).toEqual(['Prémisse', 'Conclusion', 'Objection', 'Seul']);
		expect(parsed.edges).toEqual([
			{ from: 0, to: 1, label: 'donc' },
			{ from: 1, to: 2, label: '' }
		]);
	});

	it('ignore les lignes vides et les espaces de bord', () => {
		const parsed = parseDiagram('\n  A   ->   B  \n\n');
		expect(parsed.nodes).toEqual(['A', 'B']);
	});

	it('signale la ligne fautive', () => {
		const code = (text: string) => parseDiagram(text).error;
		expect(code('')).toEqual({ line: 0, code: 'empty' });
		expect(code('A -> B\n-> C')).toEqual({ line: 2, code: 'empty-name' });
		expect(code('A -> A')).toEqual({ line: 1, code: 'self-loop' });
		expect(code('A -> B\nA -> B : encore')).toEqual({ line: 2, code: 'duplicate-edge' });
		expect(code('A -> B -> C')).toEqual({ line: 1, code: 'forbidden' });
		expect(code('Titre : sous-titre')).toEqual({ line: 1, code: 'forbidden' });
		expect(code('x'.repeat(LIMITS.maxDiagramLabel + 1))).toEqual({ line: 1, code: 'too-long' });
		const many = Array.from({ length: LIMITS.maxDiagramNodes + 1 }, (_, i) => `n${i}`).join('\n');
		expect(code(many)?.code).toBe('too-many-nodes');
	});

	it('produit des attributs acceptés par le schéma de blocs', () => {
		const { nodes, edges } = parseDiagram('A -> B : un\nB -> A : retour\nC');
		const doc = normalizeDocument({
			type: 'doc',
			content: [{ type: 'diagram', attrs: { nodes, edges } }]
		});
		expect(doc.content[0]).toEqual({ type: 'diagram', attrs: { nodes, edges } });
	});

	it('se relit après sérialisation', () => {
		const data = parseDiagram('A -> B : un\nB -> C\nD');
		const again = parseDiagram(serializeDiagram(data));
		expect(again.error).toBeNull();
		expect(new Set(again.nodes)).toEqual(new Set(data.nodes));
		const names = (d: DiagramData) =>
			d.edges.map((e) => `${d.nodes[e.from]}>${d.nodes[e.to]}:${e.label}`).sort();
		expect(names(again)).toEqual(names(data));
	});
});

describe('mise en page d’un schéma', () => {
	const overlap = (
		a: { x: number; y: number; width: number; height: number },
		b: { x: number; y: number; width: number; height: number }
	) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

	it('place une chaîne de haut en bas', () => {
		const layout = layoutDiagram(parseDiagram('A -> B\nB -> C'));
		const [a, b, c] = layout.boxes;
		expect(a.y).toBeLessThan(b.y);
		expect(b.y).toBeLessThan(c.y);
		expect(layout.paths).toHaveLength(2);
	});

	it('met côte à côte les éléments d’une même couche', () => {
		const layout = layoutDiagram(parseDiagram('A -> B\nA -> C'));
		const [, b, c] = layout.boxes;
		expect(b.y).toBe(c.y);
		expect(b.x === c.x).toBe(false);
	});

	it('supporte un cycle sans boucler : la relation de retour passe par le côté', () => {
		const layout = layoutDiagram(parseDiagram('A -> B\nB -> C\nC -> A : retour'));
		expect(layout.paths).toHaveLength(3);
		const back = layout.paths[2];
		expect(back.path.startsWith('M ')).toBe(true);
		const rightmost = Math.max(...layout.boxes.map((b) => b.x + b.width));
		expect(layout.width).toBeGreaterThan(rightmost);
	});

	it('découpe les noms longs en plusieurs lignes', () => {
		const long = 'Une très longue affirmation qui ne tient pas sur une seule ligne';
		const layout = layoutDiagram({ nodes: [long], edges: [] });
		expect(layout.boxes[0].lines.length).toBeGreaterThan(1);
		expect(layout.boxes[0].lines.join(' ')).toBe(long);
		const word = layoutDiagram({ nodes: ['x'.repeat(60)], edges: [] });
		expect(word.boxes[0].lines.join('')).toBe('x'.repeat(60));
	});

	it('est déterministe', () => {
		const data = parseDiagram('A -> B\nA -> C\nB -> D\nC -> D\nD -> A');
		expect(layoutDiagram(data)).toEqual(layoutDiagram(data));
	});

	it('ne superpose jamais deux boîtes et reste dans le cadre, pour tout graphe valide', () => {
		// Au moins deux éléments : avec un seul, aucune relation valide n'existe (pas de boucle).
		const graph = fc.integer({ min: 2, max: 12 }).chain((n) =>
			fc
				.uniqueArray(
					fc
						.tuple(fc.nat({ max: n - 1 }), fc.nat({ max: n - 1 }))
						.filter(([from, to]) => from !== to),
					{ selector: ([from, to]) => `${from}>${to}`, maxLength: 30 }
				)
				.map((pairs) => ({
					nodes: Array.from({ length: n }, (_, i) => `élément ${i}`),
					edges: pairs.map(([from, to]) => ({ from, to, label: '' }))
				}))
		);
		fc.assert(
			fc.property(graph, (data) => {
				const layout = layoutDiagram(data);
				expect(layout.boxes).toHaveLength(data.nodes.length);
				expect(layout.paths).toHaveLength(data.edges.length);
				for (const box of layout.boxes) {
					expect(box.x).toBeGreaterThanOrEqual(0);
					expect(box.y).toBeGreaterThanOrEqual(0);
					expect(box.x + box.width).toBeLessThanOrEqual(layout.width);
					expect(box.y + box.height).toBeLessThanOrEqual(layout.height);
				}
				for (let i = 0; i < layout.boxes.length; i++) {
					for (let j = i + 1; j < layout.boxes.length; j++) {
						expect(overlap(layout.boxes[i], layout.boxes[j])).toBe(false);
					}
				}
				for (const path of layout.paths) expect(path.path).not.toMatch(/NaN|Infinity/);
			})
		);
	});
});
