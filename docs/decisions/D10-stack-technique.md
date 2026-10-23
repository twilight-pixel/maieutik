# D10. Stack technique et service Tor dès le lancement

- **Date :** 2026-10-22
- **Statut :** validé

## Décision
- Stack **TypeScript de bout en bout** : SvelteKit, Tiptap, PostgreSQL, Caddy, Docker Compose.
- **Un seul serveur** au lancement, Postgres sur la même machine.
- **Service Tor onion actif dès le lancement**.
- Aucun service tiers (CDN, analytics, SaaS d'erreurs).

Détail : [08-stack-technique.md](../08-stack-technique.md).

## Conséquences
- Contraintes d'« onion-ready » dès la phase 1 : liens relatifs, aucune ressource externe.
- Limitation de débit par clé et preuve de travail, pas par adresse IP.
- **Ajustement de D06 :** dans Tor Browser, le stockage est effacé à la fermeture ; la connexion passe par l'import de la phrase ou d'un fichier de clé à chaque session.
- La phase 3 de la roadmap ne contient plus l'accès Tor (voir 07).
