## Objet

<!-- Ce que fait la PR, et pourquoi. Lien vers le document ou la décision concernés. -->

## Vie privée et sécurité

<!-- Cocher ce qui s'applique ; une case non cochée doit être expliquée. Voir docs/09 §3. -->

- [ ] Aucune lecture, aucun stockage ni journal d'adresse IP, d'User-Agent ou d'en-tête identifiant (I1, I11).
- [ ] Aucune ressource ni requête vers une autre origine ; liens relatifs (I3, onion).
- [ ] Aucun HTML brut : rendu à partir des blocs (I4).
- [ ] Aucune heure exposée, seulement des dates (I5).
- [ ] Les pages publiques restent lisibles sans JavaScript (I6). Nouvelle route publique ajoutée à `tests/invariants-vie-privee.e2e.ts`.
- [ ] Pas de nouvelle dépendance, **ou** justification ci-dessous (maintenance, dépendances transitives, scripts d'installation).
- [ ] Touche l'identité, la cryptographie, la modération ou un flux sortant : fiche de menaces jointe ou mise à jour (`docs/menaces/`).

## Dépendances ajoutées

<!-- Nom, rôle, alternatives écartées. Supprimer la section si aucune. -->

## Tests

<!-- Comment la PR a été vérifiée. -->
