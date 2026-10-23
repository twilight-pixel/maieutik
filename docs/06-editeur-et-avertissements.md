# 06. Éditeur et avertissements

## Objectif

Un éditeur **flexible et vivant** : une organisation visuelle riche, pas un champ de texte fade.

## Éditeur par blocs

| Bloc | Usage | État |
|---|---|---|
| Titres et sous-titres | Structure du texte | en place |
| Paragraphe | Texte courant | en place |
| Citation mise en valeur | Extrait cité, avec source | en place |
| Encadré | Définition, remarque, avertissement | en place (D17) |
| Colonnes | Mise en regard (thèse / réfutation) | en place (D17), 2 ou 3 colonnes |
| Note de bas de page, source intégrée | Références | en place (marque `sourceRef`, D15) |
| Formule mathématique | LaTeX, rendu KaTeX | en place (D17), en bloc et dans une ligne |
| Tableau | Données | en place (D17), sans cellules fusionnées |
| Schéma / diagramme | Argumentation visuelle | en place (D17), graphe d'éléments et de relations |
| Frise chronologique | Histoire, événements | en place (D17) |
| Image | Hébergée, métadonnées supprimées | à venir (stockage et décision à part) |
| Code | Informatique, démonstrations | en place |

Chaque texte est stocké en **données structurées** (liste de blocs) et **signé** par le pseudonyme.

### Blocs enrichis (D17)

Ils sont du **contenu signé** : des données, jamais du balisage. Le format exact, les limites et les raisons sont dans [D17](decisions/D17-editeur-enrichi.md).

| Bloc | Saisie dans l'éditeur | Lecture |
|---|---|---|
| Tableau | Bouton « Tableau », puis barre contextuelle (lignes, colonnes, en-têtes) ; Tab passe à la cellule suivante | `<table>` avec `<th scope>`, défilement horizontal au clavier |
| Formule | Bouton « Formule » (LaTeX, aperçu en direct) ou `$x^2$` dans le texte ; clic pour modifier | KaTeX, rendu côté serveur ; une formule invalide s'affiche en texte brut |
| Encadré | Bouton « Encadré » ou `:::` suivi d'un espace ; type : définition, remarque, attention | Bloc `role="note"` avec libellé |
| Colonnes | Bouton « Colonnes », puis ajouter, retirer ou dissocier | Grille, empilée sur petit écran |
| Frise | Panneau : un événement par ligne, `date \| titre \| description` | Liste ordonnée |
| Schéma | Panneau : une relation par ligne, `A -> B : étiquette` ; un nom seul crée un élément isolé | SVG calculé, avec une description en texte dépliable |

### Guidage de l'auteur

- **Raccourcis Markdown** : `##␣` titre, `###␣` sous-titre, `-␣` ou `*␣` liste à puces, `1.␣` liste numérotée, `>␣` citation, ` ```␣ ` bloc de code, `---` séparateur, `:::␣` encadré ; dans le texte, `**gras**`, `*italique*`, `~~barré~~`, `` `code` ``, `$formule$` (␣ désigne une espace).
- **Infobulles** des boutons avec leur raccourci clavier, **texte d'indication** quand l'éditeur est vide, **panneau « Aide à la mise en forme »** sous la zone de saisie, **messages d'erreur par ligne** dans les panneaux de frise et de schéma.
- **Agrandissement** : poignée de redimensionnement et plein écran (Échap pour revenir).

## Contraintes dues à l'anonymat

- **Aucun contenu tiers intégré** (vidéos, widgets, polices, scripts externes) : il révélerait l'IP du lecteur.
- **Images hébergées** par la plateforme, nettoyées de leurs métadonnées.
- **Pas de HTML brut** : rendu à partir des blocs, pour éviter les injections.
- **Taille maximale** des fichiers et des textes à définir.

## Avertissements de contenu

### Principe
L'auteur déclare des avertissements **par texte ou par bloc** (bloc `warningBlock`, D18). Le contenu concerné est **flouté ou replié** jusqu'à clic.

### Catégories proposées
- Violence
- Sexualité (non pornographique)
- Sujets sensibles : suicide, automutilation, deuil
- Images médicales
- Langage cru
- Autre (libellé court)

### Préférences du lecteur
Chaque lecteur règle ses préférences : afficher, flouter ou masquer par catégorie. Réglage conservé localement, sans compte. En place sur `/preferences` (D18).

### Avertissement manquant
Un lecteur peut signaler un **avertissement manquant** par le même mécanisme que les autres signalements (voir 05), avec une catégorie dédiée et un traitement plus léger : un simple ajout de l'avertissement, sans masquage.

### Limite
**La pornographie est interdite** (D04). Les avertissements ne servent pas à la rendre acceptable.

## Questions ouvertes

- Bibliothèque d'édition : Tiptap retenu (D10, D17). Reste à confirmer l'accessibilité complète de l'éditeur au lecteur d'écran.
- Rendu mobile : les colonnes s'empilent et les tableaux défilent ; les schémas denses restent à valider sur petit écran.
- Accessibilité : navigation clavier des panneaux et du plein écran à vérifier avec un lecteur d'écran ; contrastes suivent le thème du site.
- Avertissements de contenu **par bloc** : pas encore dans le schéma des blocs.
- Images : hébergement, réencodage et modération à décider (voir le point « Image » du tableau).
- Pièces jointes (PDF, audio, vidéo) : hors périmètre initial ?
