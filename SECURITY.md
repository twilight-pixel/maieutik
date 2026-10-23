# Politique de sécurité

_English summary below._

Maieutik protège des auteurs pseudonymes dont l'identité tient à une clé conservée dans leur navigateur. Une faille peut exposer cette clé ou réidentifier une personne : nous traitons chaque signalement en priorité.

## Signaler une vulnérabilité

- **Canal principal :** le signalement privé de vulnérabilité de la forge (onglet _Security_ → _Report a vulnerability_).
- **Canal chiffré :** à définir avant le lancement (adresse et clé publique, joignables aussi par Tor). ⚠️
- **Ne pas** ouvrir de ticket public, ni tester sur des contenus ou des pseudonymes d'autres personnes.

Un signalement pseudonyme est bienvenu : nous ne demandons aucune identité.

## Ce qui nous intéresse en particulier

- Toute fuite d'adresse IP, d'heure de publication ou d'information permettant de relier deux pseudonymes.
- Toute voie de vol ou d'usage abusif d'une clé : XSS, injection dans le rendu des blocs, code servi différent de la release signée.
- Les défauts de signature ou de canonicalisation (RFC 8785) qui permettraient d'attribuer un texte à un autre auteur.
- Le contournement de la preuve de travail ou des limites de débit à grande échelle.

Hors périmètre : déni de service volumétrique, ingénierie sociale, rapports d'outils automatiques sans preuve d'impact.

## Engagements

| Étape                      | Délai                                         |
| -------------------------- | --------------------------------------------- |
| Accusé de réception        | 72 heures                                     |
| Première évaluation        | 7 jours                                       |
| Correctif, faille critique | 48 heures après confirmation                  |
| Publication coordonnée     | 90 jours au plus, ou dès le correctif déployé |

Nous ne poursuivrons pas une recherche menée de bonne foi dans ce cadre. Pas de prime (financement par dons), mais une mention dans l'avis publié si vous le souhaitez, sous le nom de votre choix.

## Versions prises en charge

Seule la version déployée en production reçoit des correctifs. Vérifier qu'un site sert bien une release signée : `scripts/ci/verify-production.sh` (voir `docs/decisions/D12-integrite-du-code-servi.md`).

---

## English summary

Report vulnerabilities privately through the forge's _Report a vulnerability_ feature (an encrypted, Tor-reachable channel will be published before launch). Pseudonymous reports are welcome. We care most about IP or timing leaks, key theft (XSS, served code differing from the signed release) and signature or canonicalisation flaws. We acknowledge within 72 hours and coordinate disclosure within 90 days. Good-faith research is welcome; there is no bounty.
