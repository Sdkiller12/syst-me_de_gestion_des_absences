# Guide de Déploiement

Ce guide vous explique étape par étape comment déployer le frontend sur Vercel et le backend sur Render.

## 1. Déploiement du Frontend (Vercel)

L'erreur précédente (`npm error Missing script: "build"`) s'est produite car Vercel a cherché à compiler le dossier principal (qui n'a pas de script de build) au lieu du dossier `frontend`.

Voici comment le déployer correctement :

### Option A : Via le terminal (Recommandé)
1. Ouvrez votre terminal et placez-vous **dans le sous-dossier `frontend`** :
   ```bash
   cd frontend
   ```
2. Lancez la commande de déploiement Vercel :
   ```bash
   npx vercel --prod
   ```
3. Répondez aux questions :
   - *Set up and deploy?* `Y`
   - *Which scope?* Appuyez sur Entrée
   - *Link to existing project?* `N`
   - *What's your project's name?* Appuyez sur Entrée
   - *In which directory is your code located?* **Appuyez sur Entrée** (parce que vous êtes déjà dans le bon dossier !)

### Option B : Via le site web Vercel (Alternative)
1. Poussez votre code sur GitHub.
2. Allez sur le site de Vercel (vercel.com) et cliquez sur **"Add New Project"**.
3. Sélectionnez votre dépôt GitHub.
4. **Important** : Dans la section "Root Directory", cliquez sur Edit et choisissez le dossier **`frontend`**.
5. Le "Framework Preset" devrait se mettre automatiquement sur **Vite**.
6. Cliquez sur **Deploy**.

---

## 2. Déploiement du Backend (Render)

Sous Windows, la façon la plus fiable et la plus simple de déployer sur Render est d'utiliser l'intégration GitHub. Votre fichier `render.yaml` est déjà prêt.

### Étapes de déploiement
1. Poussez votre code (tout le projet) sur un dépôt **GitHub**.
2. Allez sur [dashboard.render.com](https://dashboard.render.com) et connectez-vous.
3. Cliquez sur le bouton **New +** en haut à droite, puis sélectionnez **Blueprint**.
4. Connectez votre compte GitHub (si ce n'est pas déjà fait) et sélectionnez le dépôt de votre projet.
5. Render va automatiquement lire votre fichier `render.yaml` et détecter votre backend (`gestion-absences-api`).
6. Le dashboard vous demandera de saisir les valeurs d'environnement obligatoires (sécurité) :
   - `DATABASE_URL` : L'URL de connexion à votre base de données.
   - `FRONTEND_URL` : L'URL que Vercel vous a donnée pour le frontend (ex: `https://mon-projet.vercel.app`).
   - Les clés d'API SMS si vous en avez (`SMS_API_URL`, etc.).
7. Cliquez sur **Apply** et Render va construire et lancer votre backend automatiquement !
