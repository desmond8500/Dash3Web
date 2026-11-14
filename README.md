# Dash3Web

Client web de l'ERP [Dash3](https://github.com/desmond8500/Dash3), en **Vue 3** avec le thème **[Tabler](https://tabler.io)**.

## Stack

- Vue 3 (`<script setup>`), Vite
- Vue Router, Pinia
- Axios, avec un token Sanctum envoyé en `Authorization: Bearer`
- Tabler (`@tabler/core`) et Tabler Icons (webfont)

## Installation

```console
npm install
cp .env.example .env
npm run dev
```

L'application tourne sur http://localhost:5173 et se connecte au serveur de production **https://dash3.yonkou.info** : en développement, les appels `/api` passent par le proxy Vite, ce qui évite les problèmes de CORS. Pour travailler sur un Laravel local, mettez `VITE_DEV_API_TARGET=http://127.0.0.1:8000` dans `.env`.

## Production

```console
npm run build
```

Le build appelle directement `https://dash3.yonkou.info/api/v1` (modifiable avec `VITE_API_URL`).

Le dossier `dist/` est à servir avec une réécriture de toutes les URL vers `index.html` (mode history de Vue Router). Côté Laravel, le domaine du front doit être autorisé par `CORS_ALLOWED_ORIGINS` (par défaut `*`, donc tout domaine).

## Structure

```
src/
  api/client.js            instance Axios, token, gestion des 401, normalisation des listes
  stores/auth.js           connexion / déconnexion / utilisateur courant
  router/index.js          routes et garde d'authentification
  layouts/AppLayout.vue    barre de navigation Tabler
  composables/             usePaginatedList (liste paginée avec recherche)
  components/              PageHeader, Pagination
  pages/                   Login, Tableau de bord, Clients, Projets, Tâches, 404
```

## Permissions

L'API exige un compte avec les permissions Spatie adéquates : `erp` pour les clients, projets et tâches. Sans elles, l'API répond 403 et la page affiche le message d'erreur.
