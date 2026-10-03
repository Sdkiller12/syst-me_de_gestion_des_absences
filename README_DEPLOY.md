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

### Option B : Déploiement Web Service Manuel (Sans Blueprint)
Si le Blueprint ne fonctionne pas ou si vous préférez créer le service manuellement, voici les étapes :
1. Allez sur le [dashboard Render](https://dashboard.render.com).
2. Cliquez sur le bouton **New +** en haut à droite, puis sélectionnez **Web Service**.
3. Choisissez **Build and deploy from a Git repository** et cliquez sur **Next**.
4. Connectez votre compte GitHub et sélectionnez votre dépôt.
5. Remplissez le formulaire avec les informations exactes suivantes :
   - **Name** : `gestion-absences-api`
   - **Region** : `Frankfurt (EU Central)` (ou la plus proche de votre base de données)
   - **Branch** : `main`
   - **Root Directory** : `backend`
   - **Environment** : `Node`
   - **Build Command** : `npm ci && npm run build && npx prisma generate && npx prisma migrate deploy`
   - **Start Command** : `npm start`
   - **Instance Type** : `Free` (ou payant selon vos besoins)
6. Déroulez la section **Advanced** (en bas) et ajoutez **toutes vos variables d'environnement** (Environment Variables) :
   - `DATABASE_URL` : L'URL de connexion à votre base de données
   - `FRONTEND_URL` : L'URL Vercel de votre frontend
   - `JWT_SECRET`, `JWT_REFRESH_SECRET` : Des clés secrètes générées aléatoirement
   - `NODE_ENV` : `production`
   - `PORT` : `5000`
7. Cliquez sur **Create Web Service** tout en bas de la page.

---

## 3. Alternative : Déploiement du Backend (Railway)

Railway est une excellente alternative si Render bloque votre déploiement. L'interface est très moderne et le déploiement est rapide.

### Étapes de déploiement sur Railway :
1. Allez sur le site de [Railway](https://railway.app/) et connectez-vous avec votre compte GitHub.
2. Cliquez sur le bouton **New Project** puis choisissez **Deploy from GitHub repo**.
3. Sélectionnez le dépôt de votre projet (`syst-me_de_gestion_des_absences`).
4. Cliquez sur **Deploy Now** (le déploiement va échouer la première fois, c'est normal, il faut d'abord configurer le dossier `backend` et les variables).
5. **Configuration du dossier :**
   - Cliquez sur votre projet, puis allez dans l'onglet **Settings** (Paramètres).
   - Dans la section *General*, cherchez **Root Directory** et entrez `/backend`.
   - Cliquez sur le petit bouton de validation.
6. **Commandes de build :**
   - Toujours dans **Settings**, allez dans la section *Build*.
   - Dans **Build Command**, entrez : `npm ci && npm run build && npx prisma generate && npx prisma migrate deploy`
   - Dans la section *Deploy*, pour **Start Command**, entrez : `npm start`
7. **Variables d'environnement :**
   - Allez dans l'onglet **Variables**.
   - Cliquez sur **New Variable** et ajoutez toutes vos clés :
     - `DATABASE_URL` : Votre lien Neon
     - `FRONTEND_URL` : Votre lien Vercel
     - `JWT_SECRET` et `JWT_REFRESH_SECRET` : Les clés fournies précédemment
     - `NODE_ENV` : `production`
8. **Générer une URL publique :**
   - Allez dans l'onglet **Settings** > section *Networking*.
   - Cliquez sur le bouton **Generate Domain**. Railway va vous donner une URL publique (ex: `votre-projet.up.railway.app`).
9. **Relancer le déploiement :**
   - Allez dans l'onglet **Deployments**.
   - Si ça ne s'est pas relancé tout seul, cliquez sur les 3 points à côté du dernier déploiement et faites **Redeploy**.
