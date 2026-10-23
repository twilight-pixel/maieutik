# D01. Pseudonymat par clé, sans journal ni registre

- **Date :** 2026-10-22
- **Statut :** validé

## Décision
L'identité d'un auteur est une clé cryptographique générée dans son navigateur. La plateforme ne collecte ni nom, ni e-mail, ni téléphone, et ne conserve pas d'adresse IP.

## Alternatives écartées
- Pseudonyme avec e-mail ou IP conservés : recrée le registre que le projet refuse.
- Journal chiffré déchiffrable sur décision de justice : reste un registre, technique lourde.

## Conséquences
- Pas de récupération de compte en cas de perte de clé (voir 03).
- Anti-abus par preuve de travail, limites de débit et ancienneté (voir 03).
- Conflit avec la LCEN art. 6-II si le droit français s'applique à l'opérateur (voir D02).
