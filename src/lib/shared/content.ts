/**
 * Modèle de contenu (docs/04, docs/06). Les identifiants sont stables et servent en base,
 * dans les URL et dans les contenus signés : ne jamais les renommer, seulement en ajouter.
 * Les libellés sont traduits dans messages/{fr,en}.json.
 */

export const LANGS = ['fr', 'en'] as const;
export type Lang = (typeof LANGS)[number];

/** Les 8 catégories ouvertes dès le lancement (D07), avec leurs sous-catégories. */
export const TAXONOMY = {
	sciences: ['physics', 'biology', 'mathematics', 'astronomy'],
	technology: ['computing', 'artificial-intelligence', 'cybersecurity'],
	politics: ['ideologies', 'institutions', 'geopolitics', 'governance'],
	economics: ['finance', 'markets', 'development', 'economic-theory'],
	history: ['civilizations', 'events', 'archives', 'contemporary-history'],
	philosophy: ['logic', 'ethics', 'metaphysics', 'political-thought'],
	'arts-literature': ['painting', 'music', 'cinema', 'poetry', 'criticism'],
	society: ['law', 'culture', 'education', 'religion', 'psychology', 'cross-cutting']
} as const;

export type CategoryId = keyof typeof TAXONOMY;
export type SubcategoryId = (typeof TAXONOMY)[CategoryId][number];
export const CATEGORY_IDS = Object.keys(TAXONOMY) as CategoryId[];

export const TEXT_KINDS = [
	'opinion',
	'essay',
	'fact',
	'hypothesis',
	'testimony',
	'critique'
] as const;
export type TextKind = (typeof TEXT_KINDS)[number];

/** Relations argumentatives typées. Phase 1 : seule `replies-to` est exposée. */
export const RELATION_KINDS = [
	'replies-to',
	'refutes',
	'complements',
	'provides-evidence',
	'reinterprets',
	'translation-of'
] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

export const CONTENT_WARNINGS = [
	'violence',
	'sexuality',
	'sensitive-topics',
	'medical-images',
	'crude-language',
	'other'
] as const;
export type ContentWarning = (typeof CONTENT_WARNINGS)[number];
