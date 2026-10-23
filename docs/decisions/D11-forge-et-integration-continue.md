# D11. Forge et intégration continue

- **Date :** 2026-10-22
- **Statut :** proposé, à valider

## Décision

- Code source sur **GitHub**, dépôt public, organisation pseudonyme.
- CI et release par **GitHub Actions** ; images sur **GHCR** ; signatures **Sigstore** sans clé.
- Workflows écrits pour rester portables vers **Forgejo Actions** (Codeberg ou auto-hébergé) : très peu d'actions tierces, outils lancés depuis des images de conteneur, logique dans des scripts du dépôt (`scripts/ci/`).
- Miroir du dépôt sur une seconde forge.

Détail : [10-ci-cd.md](../10-ci-cd.md).

## Raisons

- D10 exclut les services tiers **qui voient les lecteurs**. La forge ne voit que les développeurs : elle ne contredit pas D10.
- Outils de sécurité intégrés et gratuits pour un dépôt public : signalement privé de vulnérabilités, détection de secrets, Dependabot, attestations de provenance, identité OIDC pour Sigstore.
- Un dépôt public est la condition de la vérifiabilité du code servi (D12).

## Alternatives écartées

- **Forgejo auto-hébergé** : une machine de plus à exploiter et à sécuriser, contraire au serveur unique (D10). Reste l'option de repli.
- **Codeberg comme forge principale** : écosystème de CI et d'attestations moins mûr à ce jour.
- **GitLab** : sans avantage décisif ici.

## Conséquences

- **Aucun accès de la CI à la production** : le serveur tire et vérifie les releases (déploiement en mode « pull »).
- Les comptes des opérateurs sur la forge sont pseudonymes et protégés par clé matérielle (voir 09 §8 et D02).
- Risque de suspension du compte ou du dépôt : le miroir et la portabilité des workflows le limitent ; l'image et les releases signées restent vérifiables hors de GitHub.
