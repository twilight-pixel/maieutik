# 11 — Audit UX/UI (2026-10-23)

Objectif : que l'on ait envie d'apprendre, de lire, de répondre, et que l'on puisse rester des heures (de jour comme de nuit) sans fatigue.

Méthode : lecture du code (`app.css`, `+layout.svelte`, `TextView`, `TextList`, `Editor`, pages identité, questions, disciplines), puis rendu réel du serveur de dev en 1440 px et 375 px, thèmes clair et sombre. Les chiffres cités ont été mesurés.

Les contraintes de docs/01 et docs/03 restent intactes : aucune ressource tierce, aucune popularité, lecture sans JavaScript, pas d'IP. Toute proposition ci-dessous les respecte. Quand une idée demande un stockage, il est **local au navigateur** (jamais envoyé).

---

## 1. Ce qui est déjà bon (à ne pas casser)

- Lexend pour la lecture et Inter pour l'interface, auto-hébergées ; corps à 17 px ; `text-wrap: balance/pretty`, `hyphens: auto` avec `lang` par texte.
- Thème système sans JavaScript, bascule sans flash (`theme-init.js`), `prefers-reduced-motion` respecté.
- Sobriété : encre et papier, pas de bruit décoratif, dates sans heure, anneau de focus net.
- Création d'identité guidée avec sauvegarde vérifiée ; avertissements repliés (`WarningGate`).
- Page de lecture complète sans JS.

---

## 2. Constats, par gravité

### P0 — Défauts qui cassent le confort ou la confiance

| # | Constat (mesuré) | Pourquoi c'est grave | Correction |
|---|---|---|---|
| P0-1 | **Lignes de 128 caractères** : `.body` d'un texte fait 1 275 px de large sur un écran 1440 px (colonne `.page` à 80 rem, `--measure: 54rem` jamais utilisé en lecture). | Au-delà de ~75 car., l'œil perd sa ligne ; c'est la première cause de fatigue sur un long texte. | Colonne de lecture à `max-width: 66ch` (≈ 38 rem en Lexend 17,85 px). Voir §4.1. |
| P0-2 | **En-tête cassé sur mobile** : à 375 px, la page déborde (`scrollWidth` 485 px). Langue et thème sortent de l'écran. | Défaut visible dès la première page. | Navigation basse sur mobile (§4.2) ou, au minimum, `flex-wrap` + menu. |
| P0-3 | **« Écrire » est masqué sur mobile** (`.optional { display: none }`) alors que c'est l'acte central de la plateforme. | On ne peut pas contribuer depuis un téléphone sans connaître l'URL. | Toujours visible : bouton « Écrire » dans la barre basse. |
| P0-4 | **Aucun brouillon sauvegardé** (aucun `beforeunload`, aucun enregistrement local). | Un essai de 3 000 mots perdu sur une fausse manœuvre, un plantage ou un Tor Browser qui efface tout : on ne revient pas. | Brouillon local chiffré (IndexedDB) toutes les ~5 s, indicateur « Brouillon enregistré » ; `beforeunload` si modifié ; avertissement explicite si le stockage est indisponible. |
| P0-5 | **Espaces mangés par Svelte** : « Van Reybrouck,*Contre les élections* » (sources), « Récentes·Débats les plus contradictoires·Réfutations » (tri des questions). | Paraît négligé, nuit à la lisibilité. | `{','}{' '}` explicite après `{#if}` ; séparateurs en CSS (`li + li::before`). |
| P0-6 | **Accord du pluriel** : « 1 réponse(s) », « 1 position(s) », « 1 réfutation(s) sans réponse ». | Ton « formulaire » qui sort du plaisir de lire. | Messages Paraglide avec pluriel (`Intl.PluralRules`). |
| P0-7 | **Pas de lien d'évitement** (« Aller au contenu ») ; liens du menu hauts de 24 px. | Navigation clavier et tactile pénible (WCAG 2.5.8 limite ; 44 px visés). | Lien d'évitement ; zones tactiles ≥ 44 px. |

### P1 — Confort pour des sessions longues

**Le noir pur et le blanc pur fatiguent.**
Mode sombre actuel : texte `#f7f6f3` sur `#0e0e0e`, soit 17,9:1. Le contraste excessif provoque un halo (halation), surtout pour les yeux astigmates, et l'écran noir pur en pièce sombre éblouit à chaque défilement de page claire.
→ Fond `#141413`, texte `#e4e1d9` (≈ 14:1), texte atténué `#a39f95` (≈ 7:1). Voir §3.

**Pas de réglage de lecture, ni de thème intermédiaire.**
Les « Préférences de lecture » sont dans le pied de page et ne portent que sur les avertissements.
→ Menu « Aa » dans l'en-tête : taille du texte, largeur de colonne, interligne, thème (Auto / Clair / Sépia / Sombre). Stockage `localStorage`, relu par `theme-init.js` avant affichage ; sans JS, valeurs par défaut.

**Éditeur dans une boîte de 24 rem à défilement interne** (`.surface { height: 24rem; overflow: auto; resize: vertical }`).
Écrire un long texte dans une fenêtre qui défile à l'intérieur d'une page qui défile est un piège (deux barres, poignée de redimensionnement discrète).
→ Hauteur automatique (`min-height: 60dvh`, grandit avec le contenu), barre d'outils collante, colonne d'écriture à 66 ch centrée. Le plein écran existant devient « mode concentration » (raccourci `Ctrl+Maj+F`, masque la barre latérale, mots et temps de lecture discrets).

**Formulaire de publication : 6 champs et 6 cases d'un coup** (discipline, type, langue, étiquettes, avertissements ×6, publication différée).
→ Divulgation progressive : section « Avant de publier » en trois étapes courtes, avertissements repliés (ouverts si une case est cochée), valeurs par défaut intelligentes (langue du navigateur).

**Pas de signal de position dans un long texte.**
→ Sommaire des titres (colonne gauche sticky ≥ 64 rem) et barre de progression de lecture en CSS pur (`animation-timeline: scroll()`, amélioration progressive, aucun JS).

**Le thème bascule uniquement clair ↔ sombre**, sans tenir compte de `prefers-contrast` ni de `forced-colors`.
→ Variante renforcée sous `prefers-contrast: more` (lignes et texte atténué plus marqués).

### P1 — Orientation et wayfinding

- **L'état « connecté » est invisible** : l'en-tête affiche « Mon pseudonyme » que l'on ait une identité ou non. → Afficher la poignée (`Testeur#5c0c`) avec une pastille générée de façon déterministe à partir de l'empreinte (formes simples, SVG inline, aucune image). L'identité devient « sienne » sans passer par une photo ni un compteur.
- **« Recherche » nomme une page qui est surtout un fil de lecture** (titre h1 « Recherche », flux « Récemment discuté », puces de disciplines). Le mot est trompeur. → Libellé « Explorer » ; recherche en haut, flux dessous.
- **Rien n'indique l'action principale** : « Écrire » a le même poids que les autres liens. → Bouton plein en en-tête (desktop) et bouton central de la barre basse (mobile).
- **« Retour » (chevron flottant) est loin du contenu** sur grand écran (marge de 40 px à gauche d'une colonne de 1 275 px). Une fois la colonne recentrée à 66 ch, le chevron suivra ; vérifier qu'il reste dans la marge.
- **Pied de page** : quatre éléments étalés (`justify-content: space-between`) sans hiérarchie. → Regrouper à gauche, la phrase de confidentialité à droite ; garder la phrase « Aucun traceur… » (elle rassure).

### P1 — Donner envie d'apprendre (dans les règles de neutralité)

Pas de likes, pas d'abonnés, pas de mise en avant éditoriale. Il reste beaucoup de signaux structurels :

1. **Rendre l'argumentation visible.** Les relations typées sont le cœur du produit, mais ne sont aujourd'hui que des mots en capitales (`RÉFUTATIONS (1)`). Lecture d'un débat = lecture d'un graphe. → Glyphe + couleur par relation (§3.3), fil indenté sur la page d'une question (« position → réfutation → réponse »), repli par branche. C'est le meilleur objet d'apprentissage de la plateforme et il est caché.
2. **Aperçu dans les listes.** `TextList` n'affiche que titre + 7 métadonnées. L'extrait (`plain_text` existe déjà) manque hors recherche. → 2 lignes d'extrait, puis métadonnées regroupées (voir §4.3).
3. **Signaux de qualité sans popularité** : temps de lecture (« ≈ 6 min »), « 4 sources, 3 archivées », « 2 réfutations sans réponse ». Remplacent le badge pointillé négatif « Sans source ».
4. **Continuer plutôt que quitter.** Fin de texte : « Dans le même débat » (précédent / suivant dans la question), « Une réfutation sans réponse à examiner » (règle publique), bouton « Un débat au hasard » (tirage reproductible, pas éditorial).
5. **Reprise locale.** « Reprendre où j'en étais » et « À lire plus tard » (liste locale, exportable en JSON). Privé par construction, donc cohérent avec D01. À signaler honnêtement : effacé par Tor Browser.
6. **Écrire sans barrière.** `/ecrire` refuse l'éditeur tant qu'aucun pseudonyme n'existe (écran vide + une phrase). La clé ne sert qu'à **signer** : laisser écrire le brouillon, demander l'identité à « Signer et publier ». Réduit fortement l'abandon.
7. **Ton des actions de réponse.** `TextActions` met « Réfuter » en bouton plein et les cinq autres en contour : on est invité d'abord à contredire. Pour une plateforme maïeutique, tous les gestes doivent avoir le même poids, avec une ligne d'aide (« Apporter une preuve : ajouter une source qui appuie ce texte »). Ordre suggéré : Compléter, Apporter une preuve, Proposer une lecture, Réfuter, Répondre, Traduire.
8. **États vides et gardes** qui encouragent : « Il faut un pseudonyme pour écrire… » est un mur ; « Aucune source pour l'instant » est neutre ; préférer « Rien ici pour le moment — soyez le premier à répondre. » avec l'action.

### P2 — Cohérence visuelle

- **22 tailles de police distinctes** (0,72 / 0,75 / 0,78 / 0,8 / 0,82 / 0,85 / 0,88 / 0,9 / 0,92 / 0,95 rem…). Beaucoup sont des quasi-doublons que l'œil perçoit comme du flou. → 7 paliers (§3.2).
- **Rayons** : pilule (999 px, 15 occurrences), 0,5 rem (30), 0,4 / 0,3 / 0,25 rem (8). Les champs de recherche sont des pilules, les autres champs ne le sont pas. → 3 rayons (§3.4).
- **Aucune transition** (une seule : `border-color 0.15s`). Le passage clair ↔ sombre, les survols et l'ouverture des `<details>` sont secs. → Transitions de 120 ms sur couleur, fond, bordure (déjà neutralisées par `prefers-reduced-motion`).
- **Espacements en valeurs libres** (0,3 / 0,35 / 0,4 / 0,45 / 0,6 / 0,7 / 0,9 rem…). → Échelle `--space-1..8`.
- **Trois voix typographiques** pour les étiquettes (majuscules espacées sur `kind`, groupes de réponses, légendes). → Un seul style `.eyebrow`.
- **Monochrome total** : élégant, mais aucun repère. Les liens ne se distinguent que par le soulignement, les boutons primaires sont identiques partout. → Un accent unique, discret (§3.1).
- **H1 incohérents** : la page « Écrire » (non connecté) a un titre qui ressemble à une légende (petit, atténué), contrairement au commentaire de `app.css` (« titre de page identique partout »).

---

## 3. Système visuel proposé

### 3.1 Couleurs

Les valeurs sont des points de départ ; à valider avec le validateur de contraste (≥ 4,5:1 texte, ≥ 3:1 composants).

| Jeton | Clair | Sépia (nouveau) | Sombre |
|---|---|---|---|
| `--paper` | `#f7f6f3` | `#f3ecdc` | `#141413` |
| `--surface` | `#ffffff` | `#faf5e8` | `#1c1c1a` |
| `--ink` (texte) | `#1d1c1a` | `#3b342a` | `#e4e1d9` |
| `--muted` | `#5c5a55` | `#6e6556` | `#a39f95` |
| `--line` | `#e3e0d8` | `#dccfb4` | `#2e2d2a` |
| `--accent` (liens, focus, progression) | `#2a4d9b` | `#7a3b1e` | `#8fb0f5` |
| `--danger` | `#9b1c1c` | `#9b1c1c` | `#f29b9b` |

Les boutons primaires restent encre sur papier (identité monochrome de la marque) ; **l'accent ne sert qu'aux liens, au focus, à la progression et aux états actifs**.

### 3.2 Échelle typographique (7 paliers)

| Jeton | Taille | Usage |
|---|---|---|
| `--text-xs` | 0,78 rem | étiquettes (`.eyebrow`) |
| `--text-sm` | 0,875 rem | métadonnées, aides |
| `--text-md` | 1 rem | interface |
| `--text-read` | 1,05 rem × `--reading-scale` | corps des textes |
| `--text-lg` | 1,25 rem | titres de listes |
| `--text-xl` | 1,6 rem | h2 |
| `--text-2xl` | clamp(1,8 ; 4vw ; 2,6) rem | h1 |

### 3.3 Relations argumentatives (avec glyphe, jamais la couleur seule)

| Relation | Glyphe | Clair | Sombre |
|---|---|---|---|
| Réfute | ✕ | `#a8321f` | `#f0a08f` |
| Complète | ＋ | `#1f6f6a` | `#7fd0c8` |
| Apporte une preuve | § | `#3a6b2a` | `#a3d58f` |
| Réinterprète | ↻ | `#6a3fa0` | `#c4a5ee` |
| Répond | ↩ | `--muted` | `--muted` |
| Traduit | A⇄文 | `#2a5a9b` | `#9bbcf2` |

Ces glyphes en SVG inline (pas de police d'icônes tierce) apparaissent dans les titres de groupes, les listes de réponses et le fil de discussion.

### 3.4 Rayons, espacements, mouvement

```css
--r-sm: 0.375rem;   /* champs, boutons de barre d'outils */
--r-md: 0.75rem;    /* cartes, encadrés, éditeur */
--r-pill: 999px;    /* boutons, puces, étiquettes */
--space-1: 0.25rem; --space-2: 0.5rem;  --space-3: 0.75rem; --space-4: 1rem;
--space-5: 1.5rem;  --space-6: 2rem;    --space-7: 3rem;    --space-8: 4.5rem;
--ease: 120ms ease-out;
--measure: 66ch;
```

### 3.5 Préférences de lecture (menu « Aa »)

`data-text-size="s|m|l|xl"` (échelle 0,9 → 1,3), `data-measure="narrow|normal|wide"` (56 / 66 / 78 ch), `data-leading="normal|loose"` (1,65 / 1,9), `data-theme="auto|light|sepia|dark"`.
Tout est posé sur `<html>` par `theme-init.js` avant le premier affichage. L'élément est un `<button popover>` natif.

---

## 4. Maquettes en mots

### 4.1 Page d'un texte (≥ 64 rem)

```
┌ ? ── Explorer  Questions  À répondre ──────────  [Écrire]  (T) Testeur#5c0c  Aa ┐
│ ‹                                                                                  │
│  Sommaire          Politique › Institutions                     Dans ce débat      │
│  ● Introduction    ESSAI · FR · ≈ 6 min · 4 sources              ▸ Question          │
│    Les objections  # Le tirage au sort renforce la démocratie      « Faut-il… ? »   │
│    Conclusion      par Alice#12f8 · 23 octobre 2026                ✕ 1 réfutation   │
│                                                                    sans réponse     │
│                    Corps du texte sur 66 ch…                       ＋ 2 compléments  │
│                                                                                    │
│                    [Compléter] [Preuve] [Lecture] [Réfuter] [Répondre] [Traduire]   │
│                    Réponses — ✕ Réfutations (1) …                                   │
└────────────────────────────────────────────────────────────────────────────────────┘
```
Colonne centrale à 66 ch, sommaire à gauche (sticky), « Dans ce débat » à droite (sticky). Sous 64 rem : une seule colonne, sommaire dans un `<details>`.

### 4.2 Mobile (375 px)

- En-tête réduit : logo + « Aa » + thème.
- **Barre basse** (hauteur 56 px + zone sûre) : Explorer · Questions · **Écrire** (rond plein) · À répondre · Moi. Chaque cible ≥ 44 px.
- Langue FR/EN dans « Aa » (ou dans « Moi »).
- Les trois piliers de la page d'accueil (aujourd'hui `display: none` sous 48 rem) reviennent en 3 lignes d'une phrase, car ils expliquent le produit.

### 4.3 Élément de liste (flux, résultats, réponses)

```
✕ Réfutation · Bob#d459 · 23 oct. 2026
Le tirage au sort ignore la compétence
Deux lignes d'extrait du texte, tronquées proprement…
Institutions · FR · ≈ 4 min · 1 réponse
```
La ligne entière est cliquable (lien étiré `::after`) avec un fond `--surface` au survol ; le titre reste le seul lien pour les lecteurs d'écran.

### 4.4 Page d'accueil

Remplacer le seul slogan par **un exemple vivant** : une mini-conversation figée (thèse → réfutation → réponse) avec les relations colorées. Montrer vaut mieux que dire. Les trois piliers deviennent trois légendes sous ce schéma.

---

## 5. Plan de mise en œuvre et état final (2026-10-23)

Tous les lots sont faits. Les contrôles automatiques les couvrent en partie : `theme.spec.ts` (contrastes des trois thèmes, des couleurs de relation et du contraste renforcé), `reading.spec.ts`, `draft.spec.ts`, `reading-view.spec.ts`, et les e2e `ui-brouillon`, `ui-phase2` (fil et signaux) et `api-phase2`.

| Lot | Contenu | État |
|---|---|---|
| **A** | Mesure de lecture (`--page-reading`), espaces manquants, pluriels Paraglide, lien d'évitement, zones tactiles de 44 px | fait |
| **B** | Navigation : rubriques « Explorer · Questions · À répondre », « Écrire » toujours visible, pastille du pseudonyme (`Pastille.svelte`), menu « Réglages » (`NavMenu.svelte`), barre basse sous 46 rem, pied de page réduit à la transparence | fait (session « Redesign navigation ») |
| **C** | Jetons (couleurs, rayons, six tailles, espacements, mouvement), thème sombre adouci, thème **sépia**, `--link`, transitions de 120 ms, contraste renforcé | fait |
| **D** | Menu « Aa » (taille, largeur, interligne, thème), `theme-init.js` étendu, plan des titres, barre de progression, temps de lecture, reprise de lecture | fait |
| **E** | Éditeur à hauteur automatique, barres collées, brouillon local, écriture avant l'identité | fait |
| **F** | Relations visuelles (`RelationMark.svelte`), fil de discussion, début de texte et faits structurels dans les listes | fait |

### Choix qui méritent d'être connus

- **Reprise de lecture** (`reading-position.ts`) : avancement gardé dans le `localStorage`, jamais envoyé, sans date ni heure, 20 textes au plus, pour les textes d'au moins 5 minutes. Absent si le stockage est indisponible (Tor Browser).
- **Brouillon** (`draft.ts`) : gardé **en clair** dans le `localStorage` (texte destiné à devenir public, dix contextes au plus, ni date ni heure). Le chiffrer n'apporterait rien tant qu'aucune clé n'existe.
- **Boutons de réponse** : les six gestes (compléter, preuve, autre interprétation, réfuter, répondre, traduire) ont le même poids ; la réfutation n'est plus le seul bouton plein.
- **Neutralité** : les faits montrés dans les listes (temps de lecture, sources, réponses, réfutations sans réponse) ne changent jamais l'ordre. Ils s'appuient sur docs/04 §7.
- **Largeur de lecture** : elle suit la taille du texte (environ 65 caractères par ligne dans tous les cas).
- **Espacements** : 284 déclarations de marge, de remplissage et d'écart sont passées aux jetons `--space-1` à `--space-7` (arrondies au palier le plus proche). Restent en dur : les filets d'un pixel, les valeurs négatives, celles de 3,5 rem et plus (dont l'écart de la barre basse) et tout ce qui est en `calc()` ou `clamp()`.

### Ce qui n'a pas été fait

- **Formulaire de publication** : les avertissements et les options restent affichés d'un bloc, sans étapes.
- **Page d'accueil** : l'exemple de conversation vivant (§4.4) n'est pas fait ; les trois piliers restent masqués sur mobile.
- **Continuer plutôt que quitter** : « dans le même débat » (précédent / suivant), « un débat au hasard » et « à lire plus tard ». Le tirage au hasard doit d'abord être validé avec docs/01 (règle publique de découverte).
- **Ligne de liste entièrement cliquable** (§4.3) : seul le titre est un lien.
- **Libellés** : un style unique pour les étiquettes en majuscules (`.eyebrow`) et les messages à deux compteurs (« signalement(s) traité(s) », dans l'espace du référent) restent à reprendre.
- **Tests transversaux** : débordement horizontal à 375 px sur chaque route de `ROUTES`.

---

## 6. Questions ouvertes

- ~~Un thème sépia est-il souhaité ?~~ Oui, validé (2026-10-23).
- Où poser la limite entre « signal structurel » et mise en avant (docs/01) ? Les faits des listes (temps de lecture, sources, réponses, réfutations sans réponse) sont retenus car ils suivent des règles publiques et ne trient rien. Reste à décider pour le « débat au hasard ».
- ~~Écrire avant d'avoir une identité~~ : fait, le brouillon local n'est jamais envoyé, seul le texte signé l'est. À faire relire avec docs/03.
- ~~Brouillon chiffré ?~~ Non, en clair dans le `localStorage` (voir le lot E) ; à revoir si une clé d'appareil est un jour introduite.
