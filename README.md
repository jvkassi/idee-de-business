# Djossi

Djossi, c'est ton pote à Abidjan pour les idées de business : tu racontes
ton idée à voix haute, la communauté vote et réagit, et Djossi la range,
la note et l'illustre. Les offres d'emploi vérifiées sont là aussi.
Gratuit, en français.

## Stack

- **Next.js 16 (App Router, SSR)** — rendu serveur, Server Actions pour les
  formulaires (pas d'API REST séparée à maintenir).
- **Neon (Postgres serverless)** — base relationnelle managée, connectée
  directement au projet Vercel (intégration marketplace) : `DATABASE_URL`
  est fournie automatiquement, aucune base locale à gérer même en dev.
- **Vercel Blob** — stockage des illustrations générées par l'IA (fichiers
  image, pas de blobs en base). Même principe : connectée au projet Vercel,
  `BLOB_READ_WRITE_TOKEN` est fournie automatiquement.
- **Google Gemini** — appelé directement en backend (aucune clé exposée au
  navigateur) pour :
  - structurer/améliorer chaque idée (cible, proposition de valeur, modèle
    de revenus, premiers pas, risques, score sur 100) ;
  - générer une illustration de couverture (flat design) pour chaque idée,
    uploadée sur Vercel Blob juste après génération.
- **Auth ultra légère** — juste un pseudo (pas de mot de passe), stocké dans
  un cookie de session signé (HMAC). Volontairement minimal pour un MVP :
  pas de compte à gérer, pas de mot de passe à sécuriser.

## Démarrer en local

```bash
cp .env.example .env.local
# renseigner GEMINI_API_KEY (https://aistudio.google.com/apikey), DATABASE_URL
# (une base Neon — vercel env pull récupère celle du projet lié) et
# BLOB_READ_WRITE_TOKEN (idem via vercel env pull)
npm install
npm run dev
```

Il n'y a pas de repli local sans base de données : `DATABASE_URL` est
obligatoire, y compris en dev (on utilise la même base Neon qu'en prod,
ou une base Neon de dev séparée si besoin — le schéma se crée tout seul
au premier appel).

## Déployer sur Vercel

1. **Importer le projet sur Vercel** (vercel.com/new, ou `vercel link`).
2. **Connecter Neon** : `vercel integration add neon` (ou depuis le
   dashboard Vercel → Storage → Marketplace). Provisionne une base Postgres
   et renseigne `DATABASE_URL` sur les 3 environnements automatiquement.
3. **Connecter Vercel Blob** : `vercel blob create-store <nom> --access public`
   (ou depuis le dashboard). Renseigne `BLOB_READ_WRITE_TOKEN` automatiquement.
4. **Variables d'environnement** restantes à définir sur le projet Vercel :
   - `GEMINI_API_KEY`
   - `SESSION_SECRET` (chaîne aléatoire longue, ex: `openssl rand -hex 32`)
    - `IDEAS_TEXT_MODEL` (optionnel, défaut `gemini-flash-latest`)
    - `IDEAS_IMAGE_MODEL` (optionnel, défaut `gemini-3.1-flash-image`)
    - `WAHA_BASE_URL` (optionnel, défaut `https://bot.labs.synelia.tech`)
    - `WAHA_API_KEY` — clé API WAHA (offres d'emploi WhatsApp)
    - `WAHA_SESSION` (optionnel, défaut `Etd0MVpT9b`)
    - `CRON_SECRET` (optionnel, protège `/api/jobs/sync`)
5. Déployer (`vercel deploy --prod`, ou push sur `main` — voir CI/CD
   ci-dessous). Le schéma Postgres (tables + catégories) est créé
   automatiquement au premier appel — aucune migration manuelle à lancer.

## Offres d'emploi WhatsApp (WAHA + Gemini)

La page `/jobs` affiche les offres détectées par Gemini dans 2 groupes
WhatsApp suivis via WAHA (session `Etd0MVpT9b`) : *Opportunités emploi et
services VH AGM* et *Emploi-Business-Vente*.

- **Synchro manuelle** : bouton "Synchroniser" sur `/jobs`, ou
  `POST /api/jobs/sync?limit=20`.
- **Temps réel** : déclarer le webhook WAHA
  `https://<domaine>/api/jobs/whatsapp` (event `message.any`) sur la session.
- **Cron Vercel** : `vercel.json` planifie `/api/jobs/sync` toutes les 2 h.

Sur Vercel, si `DATABASE_URL` n'est pas défini, l'app refuse de servir une
requête base de données plutôt que d'échouer silencieusement.

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

- L'auth par pseudo seul n'empêche pas l'usurpation d'un pseudo existant si
  quelqu'un le devine (pas de mot de passe). Suffisant pour un MVP entre
  connaissances / une communauté de confiance, à muscler (PIN, email magic
  link, OAuth…) avant une ouverture plus large.
- Pas de modération de contenu ni de rate limiting : à ajouter avant une
  mise en ligne publique (signalement, filtrage anti-spam via l'IA, limite
  d'idées/commentaires par utilisateur ou IP).
- Le fil d'accueil charge jusqu'à 100 idées sans pagination : à revoir
  (pagination ou scroll infini) avant que le volume d'idées ne devienne
  important.
