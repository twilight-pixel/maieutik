# Maieutik : documentation projet

Plateforme publique d'expression intellectuelle écrite, organisée par disciplines, où l'on dialogue par des textes liés entre eux. Les auteurs sont pseudonymes et durables, sans aucune identité civile collectée.

> Statut : cadrage validé le 2026-10-22. Aucun code écrit à ce stade.
> Les points marqués ⚠️ sont à valider par un avocat avant lancement.

## Sommaire

| Fichier | Contenu |
|---|---|
| [01-vision-et-principes.md](01-vision-et-principes.md) | Proposition de valeur, principes directeurs, indicateurs de succès |
| [02-juridique.md](02-juridique.md) | Analyse juridique, statut d'hébergeur, structure, points ouverts |
| [03-anonymat-et-securite.md](03-anonymat-et-securite.md) | Identité par clé, persistance du pseudonyme, modèle de menaces |
| [04-modele-de-contenu.md](04-modele-de-contenu.md) | Taxonomie, types de textes, relations argumentatives, dossiers, sources |
| [05-moderation-et-qualification.md](05-moderation-et-qualification.md) | Règles, signalement, jury, référent juridique, journal public |
| [06-editeur-et-avertissements.md](06-editeur-et-avertissements.md) | Éditeur par blocs, avertissements de contenu |
| [07-roadmap.md](07-roadmap.md) | Phases, périmètre, démarrage à froid |
| [08-stack-technique.md](08-stack-technique.md) | Stack TypeScript, hébergement, service Tor, points délicats |
| [09-sdlc-devsecops.md](09-sdlc-devsecops.md) | Cycle de développement sécurisé, invariants de vie privée testés, réponse aux incidents |
| [10-ci-cd.md](10-ci-cd.md) | Pipeline de CI, release signée, déploiement par le serveur, surveillance |
| [11-audit-ux-ui.md](11-audit-ux-ui.md) | Audit UX/UI : confort de lecture, mobile, système visuel, plan par lots |
| [decisions/](decisions/) | Une note par décision structurante |

## Décisions validées (résumé)

| # | Décision |
|---|---|
| D01 | Pseudonymat par clé cryptographique, sans journal ni registre |
| D02 | Risque juridique lié à la localisation des opérateurs : accepté pour l'instant |
| D03 | Qualification de l'illégalité en trois niveaux (signalement motivé, jury, référent) |
| D04 | Modération limitée à l'illégal et à quatre règles structurelles |
| D05 | Retrait par l'auteur avec trace conservée, historique de versions public |
| D06 | Le pseudonyme est stable d'une visite à l'autre et d'un appareil à l'autre |
| D07 | Périmètre complet dès le départ (8 catégories), FR et EN |
| D08 | Financement par dons et fonds propres, sans publicité |
| D09 | Publication différée optionnelle, dates affichées sans heure |
| D10 | Stack TypeScript (SvelteKit, Postgres, Caddy), un seul serveur, service Tor onion dès le lancement |

## Décisions proposées (à valider)

| # | Décision |
|---|---|
| D11 | Forge GitHub et GitHub Actions, workflows portables vers Forgejo ; la CI n'a aucun accès à la production |
| D12 | Intégrité du code servi : build reproductible, manifeste signé, vérification externe horaire |
| D13 | Une application SvelteKit à la racine ; noyau isomorphe `src/lib/shared` isolé par le lint, extractible en paquet |
| D14 | Écritures signées sans session ; preuve de travail (protocole Altcha) implémentée en interne ; publication différée par date |
| D15 | Débat structuré : relations typées et questions dans le contenu signé, sources archivées par un robot isolé (instantané textuel) |
| D16 | Jury tiré au sort vérifiable (engagement puis révélation), rotation de clé à double signature, transfert par QR code, export signé |
| D17 | Éditeur enrichi : tableaux, formules (KaTeX rendu côté serveur), encadrés, colonnes, frises et schémas, tous en données signées |
| D18 | Signalement des questions, recours de l'auteur, fiabilité des signaleurs, vivier du jury figé ; préférences de lecture ; invitations et pseudonymes d'équipe ; PWA |

## Questions encore ouvertes

Voir la fin de chaque fichier, et [07-roadmap.md](07-roadmap.md) pour la liste consolidée.
