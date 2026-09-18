# Frontend — Gestion des présences scolaire (production, zéro mock)

## Présentation
Interface React + TypeScript + Vite + Tailwind. **100% des données proviennent de l'API REST / PostgreSQL.** Aucune donnée simulée : sans données, chaque page affiche un état vide réel.

Pages : `/login`, `/register-school` (onboarding école), `/dashboard`, `/classes`, `/students` (+ import Excel réel), `/courses`, `/attendance`, `/notifications` (= `/sms`), `/history`, `/teachers` (admin), `/audit-logs` (admin), `/settings` (école + config SMS).

## Stack
React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Axios, TanStack Query, React Hook Form, Zod, SheetJS (modèle uniquement), Lucide.

## Installation
```bash
npm install
npm run dev
npm run build
npm run preview
```

## Variables d'environnement
```env
VITE_API_URL=http://localhost:5000/api
```
En production : `VITE_API_URL=https://api.votre-domaine.com/api`. Aucune URL localhost en production. Le frontend ne contient aucun secret (pas de clé SMS, pas de JWT_SECRET).

## Authentification réelle
Login vérifié contre PostgreSQL (bcrypt + JWT + refresh token avec renouvellement automatique). Rôles : `SUPER_ADMIN` / `SCHOOL_ADMIN` / `TEACHER` (garde frontend + backend). Déconnexion via `POST /auth/logout`.

## Import Excel réel
`POST /students/import?classId=...` (multipart). Le backend persiste dans PostgreSQL et retourne `{analyzed, imported, duplicates, invalid, errors[{row,message}]}`. Colonnes : Prénom | Nom | Matricule | Téléphone | Téléphone parent | Email | Classe.

## États d'interface
Chaque page gère Loading / Success / Empty / Error / Network (message « Connexion perdue »). Les mutations invalident React Query et rechargent depuis le serveur — jamais d'optimisme local.

## Build production
```bash
npm run build
```
Sortie dans `dist/`, déployable sur Vercel.
