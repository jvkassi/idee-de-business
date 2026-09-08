# Idées de Business

Plateforme communautaire où chacun peut proposer une idée de business, la
communauté vote et commente, et une IA (Google Gemini) l'améliore et
l'illustre automatiquement.

## Stack

- **Next.js 16 (App Router, SSR)** — rendu serveur, Server Actions pour les
  formulaires (pas d'API REST séparée à maintenir).
- **Turso (libsql)** — base SQLite distribuée, gratuite pour un usage type
  MVP, compatible avec le déploiement serverless de Vercel. En local, elle
  retombe automatiquement sur un fichier SQLite (`./data/ideas.db`).
- **Google Gemini** — appelé directement en backend (aucune clé exposée au
  navigateur) pour :
  - structurer/améliorer chaque idée (cible, proposition de valeur, modèle
    de revenus, premiers pas, risques, score sur 100) ;
  - générer une illustration de couverture (flat design) pour chaque idée.
- **Auth ultra légère** — juste un pseudo (pas de mot de passe), stocké dans
  un cookie de session signé (HMAC). Volontairement minimal pour un MVP :
  pas de compte à gérer, pas de mot de passe à sécuriser.

## Démarrer en local

```bash
cp .env.example .env.local
# renseigner GEMINI_API_KEY (https://aistudio.google.com/apikey)
npm install
npm run dev
```

Sans `TURSO_DATABASE_URL`, l'app utilise un fichier SQLite local
(`./data/ideas.db`) — parfait pour le développement.

## Déployer sur Vercel

1. **Créer la base Turso** (gratuite) :
   ```bash
   npm install -g @tursodatabase/cli   # ou: curl -sSfL https://get.tur.so/install.sh | bash
   turso auth login
   turso db create idees-business
   turso db show idees-business --url          # -> TURSO_DATABASE_URL
   turso db tokens create idees-business        # -> TURSO_AUTH_TOKEN
   ```
2. **Importer le projet sur Vercel** (vercel.com/new, ou `vercel` CLI).
3. **Variables d'environnement** à définir sur le projet Vercel :
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `GEMINI_API_KEY`
   - `SESSION_SECRET` (chaîne aléatoire longue, ex: `openssl rand -hex 32`)
   - `GEMINI_MODEL` (optionnel, défaut `gemini-3.5-flash`)
   - `GEMINI_IMAGE_MODEL` (optionnel, défaut `gemini-3.1-flash-image`)
4. Déployer. Le schéma SQLite (tables + catégories) est créé automatiquement
   au premier appel — aucune migration manuelle à lancer.

Sur Vercel, si `TURSO_DATABASE_URL` n'est pas défini, l'app refuse de
démarrer une requête base de données plutôt que d'écrire silencieusement
dans un système de fichiers éphémère qui perdrait les données.

## CI/CD (GitHub Actions)

- `.github/workflows/ci.yml` : lint + build sur chaque push et chaque PR
  vers `main`.
- `.github/workflows/deploy.yml` : déploie automatiquement en production sur
  Vercel à chaque push sur `main`.

Secrets à ajouter sur le dépôt GitHub (Settings → Secrets and variables →
Actions) pour que le déploiement fonctionne :
- `VERCEL_TOKEN` — jeton personnel Vercel (vercel.com/account/tokens).
- `VERCEL_ORG_ID` — `team_OK32u0Kw0W0VTHna9v2r5LnQ`
- `VERCEL_PROJECT_ID` — `prj_uxeTOoU1sOUKGcgR7gHRi1xYus9n`

(Les variables d'environnement de l'app elle-même — `GEMINI_API_KEY`,
`IDEAS_TEXT_MODEL`, `IDEAS_IMAGE_MODEL`, `SESSION_SECRET` — sont déjà
configurées directement sur le projet Vercel, pas besoin de les dupliquer
en secrets GitHub.)

## Limites connues du MVP (à faire évoluer si ça prend)

- Les illustrations générées sont stockées en base (data URL base64,
  ~0.5-1 Mo par idée). Très bien pour démarrer, mais à migrer vers un
  stockage objet (Vercel Blob, S3…) si le volume d'idées grossit — Turso
  facture au stockage au-delà du quota gratuit.
- L'auth par pseudo seul n'empêche pas l'usurpation d'un pseudo existant si
  quelqu'un le devine (pas de mot de passe). Suffisant pour un MVP entre
  connaissances / une communauté de confiance, à muscler (email magic link,
  OAuth…) avant une ouverture plus large.
- Pas de modération de contenu : à ajouter avant une mise en ligne publique
  (signalement, filtrage, rate limiting sur la création d'idées/commentaires).
