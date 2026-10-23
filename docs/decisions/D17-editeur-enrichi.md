# D17. Éditeur enrichi : tableaux, formules, encadrés, colonnes, frises, schémas

- **Date :** 2026-10-23
- **Statut :** validé (fin de la phase 3, hors blocs-fichiers)

## Décision

### 1. Nouveaux blocs du document signé

Tous s'ajoutent au schéma de `src/lib/shared/blocks.ts`. Les types existants ne changent pas : les textes déjà signés restent valides. Chaque bloc est validé de façon stricte, à l'identique dans le navigateur (avant signature) et sur le serveur, qui refuse tout attribut non normalisé.

| Bloc | Contenu signé | Limites |
|---|---|---|
| `table` | lignes `tableRow` de cellules `tableHeader` ou `tableCell` ; une cellule ne contient que des paragraphes | 100 lignes, 20 colonnes, lignes de même longueur, **pas de cellules fusionnées** |
| `mathBlock` | `attrs.latex` | 2 000 caractères |
| `mathInline` | nœud en ligne, `attrs.latex`, sans saut de ligne | 2 000 caractères |
| `callout` | `attrs.variant` (`definition`, `remark`, `warning`) et des blocs | profondeur du document (12) |
| `columns` | 2 ou 3 `column`, chacune contenant des blocs | – |
| `timeline` | `attrs.events` : `{date, title, text}` | 50 événements ; date 40, titre 200, description 1 000 caractères |
| `diagram` | `attrs.nodes` (noms) et `attrs.edges` (`{from, to, label}` par position) | 30 éléments, 60 relations, 80 caractères par nom ou étiquette ; pas de doublon, pas de relation d'un élément avec lui-même |

Principes :

- **Des données, jamais du code ni du balisage.** Une formule est du LaTeX, une frise une liste d'événements, un schéma un graphe. Rien n'est du HTML ou du SVG. Les chaînes sont rognées, bornées et sans caractère de contrôle (saut de ligne et tabulation permis dans une formule en bloc seulement).
- **La normalisation est déterministe** : `normalizeDocument` reconstruit chaque bloc attribut par attribut, `validateDocument` refuse tout ce qui diffère. Les attributs que Tiptap ajoute (largeur de colonne, alignement…) sont retirés avant signature.
- **Texte brut pour la recherche** : `plainText` inclut cellules, formules, événements, noms et étiquettes de schémas. Les liens et renvois de sources placés dans une cellule, un encadré ou une colonne sont comptés comme ailleurs.

### 2. Lecture sans JavaScript

- **Formules : KaTeX, rendu côté serveur** (`katex.renderToString`), avec `trust: false` (pas de `\href`, `\url`, `\includegraphics`, `\htmlClass`…), `maxExpand` et `maxSize` bornés (`src/lib/math.ts`). Une formule invalide s'affiche en texte brut. La feuille de style et les polices viennent du paquet, servies par la plateforme (aucune ressource tierce).
- **Seule exception à « jamais de `{@html}` »** : `src/lib/components/Math.svelte`, qui injecte la sortie de KaTeX et rien d'autre. Elle est annoncée par la règle Semgrep `maieutik-no-raw-html-svelte` et marquée `nosemgrep` avec ESLint désactivé sur ce seul fichier ; toute modification du composant est à relire.
- **Schémas : SVG calculé, pas stocké.** `src/lib/shared/diagram.ts` place les éléments en couches (de haut en bas), ordonne chaque couche pour limiter les croisements et trace les relations en courbes ; un cycle passe par le côté. Le calcul est déterministe, donc identique sur le serveur et dans le navigateur. Une **description en texte** (une relation par ligne) est toujours fournie sous le dessin, pour les lecteurs d'écran et pour les schémas denses.
- **Tableaux** : `<th scope>` pour les en-têtes, zone défilante au clavier ; **colonnes** : grille qui s'empile sur petit écran ; **frises** : liste ordonnée ; **encadrés** : `role="note"` avec libellé.

### 3. Éditeur

- Tiptap : `@tiptap/extension-table` (cellules limitées aux paragraphes), extensions maison (`src/lib/client/editor-extensions.svelte.ts`) pour encadrés, colonnes, formules, frises et schémas, `@tiptap/extensions` pour l'indication de l'éditeur vide.
- **Saisie d'une formule, d'une frise ou d'un schéma** : un panneau avec un champ de texte, un aperçu et des messages d'erreur par ligne. La frise se saisit `date | titre | description`, le schéma `A -> B : étiquette`. Un clic sur le bloc, ou Entrée quand il est sélectionné, le rouvre. Le bloc affiché dans l'éditeur est celui de la lecture (mêmes composants Svelte).
- **Barre contextuelle** selon la position du curseur : lignes et colonnes d'un tableau, colonnes (ajouter, retirer, dissocier), type d'encadré.
- **Guidage** : raccourcis Markdown (`##␣`, `-␣`, `1.␣`, `>␣`, `` ```␣ ``, `---`, `:::␣`, `**gras**`, `*italique*`, `~~barré~~`, `` `code` ``, `$formule$`), raccourcis clavier dans les infobulles, texte d'indication quand l'éditeur est vide et panneau d'aide repliable.
- Une source retirée supprime ses renvois dans le texte ; un paragraphe vide en fin de texte est retiré avant signature.

## Alternatives écartées

- **Mermaid ou Graphviz pour les schémas** : dépendances lourdes, rendu côté navigateur seulement (donc pas de lecture sans JavaScript), ou SVG généré à stocker et à valider. Un graphe en données est plus petit, vérifiable et accessible.
- **Stocker le SVG ou le HTML de KaTeX dans le texte signé** : cela ferait entrer du balisage dans le contenu signé (surface XSS) et figerait un rendu. On signe le LaTeX et on rend à la lecture.
- **KaTeX rendu dans le navigateur seulement** : la lecture sans JavaScript montrerait du LaTeX brut.
- **Cellules fusionnées, largeurs de colonnes réglables** : source de complexité d'accessibilité et de rendu mobile pour peu de gain ; ajoutables plus tard sans casser les textes signés.

## Conséquences

- Le code client embarque KaTeX (quelques centaines de Ko avant compression) : sur les pages de lecture comme dans l'éditeur, puisque le rendu serveur est ré-hydraté. À surveiller si le poids des pages devient un sujet (Tor).
- Les polices de KaTeX ajoutent des fichiers au build ; seul le format utile au navigateur est chargé.
- Les nouveaux blocs sont des ajouts : un serveur ou un client plus ancien refuse un texte qui les contient. Le déploiement doit rester **serveur d'abord**, comme pour toute migration additive (docs/10 §2).
- Les **images, vidéos et pièces jointes** restent hors de cette décision : elles exigent un stockage, un réencodage serveur et un traitement de modération (docs/06, docs/09 I12).

## Points ouverts

- Largeur maximale des tableaux sur mobile : défilement horizontal pour l'instant.
- Schémas denses ou comptant de longues relations qui traversent d'autres éléments : le tracé reste lisible mais pas optimal ; la description en texte fait foi.
- Polices mathématiques : KaTeX est servi avec ses propres polices ; vérifier le rendu dans Tor Browser.
- Avertissements de contenu **par bloc** (docs/06) : pas encore dans le schéma.
