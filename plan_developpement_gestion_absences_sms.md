# Plan de développement — Application de gestion des absences et notifications SMS

## 1. Vue d'ensemble

Application web accessible depuis un navigateur permettant :

- d'importer une liste d'étudiants depuis Excel ;
- d'organiser les étudiants par classe ;
- d'enregistrer les présences et absences ;
- d'associer chaque étudiant à un numéro de téléphone ;
- d'envoyer un SMS au contact associé lorsqu'une absence est enregistrée ;
- de consulter l'historique des absences et des notifications.

## 2. Stack technique

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Axios
- React Hook Form
- Zod
- TanStack Query
- SheetJS (`xlsx`)

### Backend

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT
- bcrypt
- Zod
- API REST

### Services externes

- Fournisseur SMS avec API compatible avec la Côte d'Ivoire
- Hébergement frontend : Vercel
- Hébergement backend : Render ou Railway
- PostgreSQL : Neon ou Supabase

---

# 3. Architecture générale

```text
                    NAVIGATEUR
                        |
                        v
              +-------------------+
              | React + TypeScript|
              | Tailwind CSS      |
              +---------+---------+
                        |
                   REST / JSON
                        |
                        v
              +-------------------+
              | Node.js + Express |
              |                   |
              | Auth              |
              | Classes           |
              | Étudiants         |
              | Présences          |
              | Import Excel       |
              | Notifications SMS |
              +----+---------+----+
                   |         |
                   v         v
             PostgreSQL   SMS API
```

---

# 4. Phase 0 — Préparation du projet

## Objectifs

Définir précisément les règles métier avant de coder.

### À définir

- rôles utilisateurs ;
- structure des classes ;
- format Excel accepté ;
- règles de présence ;
- format des numéros de téléphone ;
- contenu des SMS ;
- comportement en cas d'échec SMS ;
- politique de sécurité ;
- durée de conservation des données.

### Rôles MVP

#### Administrateur

- gérer les utilisateurs ;
- créer/modifier/supprimer les classes ;
- consulter toutes les données ;
- importer les étudiants.

#### Enseignant

- consulter ses classes ;
- enregistrer les présences ;
- enregistrer les absences ;
- envoyer les notifications ;
- consulter l'historique.

---

# 5. Phase 1 — Initialisation du projet

## Frontend

Créer le projet :

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

Installer :

```bash
npm install react-router-dom axios
npm install @tanstack/react-query
npm install react-hook-form zod @hookform/resolvers
npm install xlsx
```

Installer Tailwind CSS selon la version actuelle de Tailwind.

### Structure

```text
frontend/
├── src/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   ├── features/
│   ├── hooks/
│   ├── services/
│   ├── types/
│   ├── schemas/
│   ├── utils/
│   ├── routes/
│   ├── App.tsx
│   └── main.tsx
├── public/
└── package.json
```

## Backend

Créer :

```bash
mkdir backend
cd backend
npm init -y
```

Installer :

```bash
npm install express cors dotenv jsonwebtoken bcrypt
npm install zod
npm install @prisma/client
npm install
```

Développement :

```bash
npm install -D typescript tsx @types/node @types/express
npm install -D @types/cors @types/jsonwebtoken @types/bcrypt
```

Initialiser TypeScript :

```bash
npx tsc --init
```

Initialiser Prisma :

```bash
npx prisma init
```

---

# 6. Phase 2 — Conception de la base de données

## Modèles principaux

### User

```text
User
├── id
├── name
├── email
├── passwordHash
├── role
├── createdAt
└── updatedAt
```

### Class

```text
Class
├── id
├── name
├── academicYear
├── createdAt
└── updatedAt
```

### Student

```text
Student
├── id
├── classId
├── firstName
├── lastName
├── phone
├── createdAt
└── updatedAt
```

### Course

```text
Course
├── id
├── classId
├── teacherId
├── subject
├── date
├── startTime
└── endTime
```

### Attendance

```text
Attendance
├── id
├── courseId
├── studentId
├── status
├── recordedAt
└── recordedBy
```

Statuts :

```text
PRESENT
ABSENT
LATE
JUSTIFIED
```

### SmsLog

```text
SmsLog
├── id
├── studentId
├── attendanceId
├── phone
├── message
├── status
├── providerMessageId
├── errorMessage
└── sentAt
```

---

# 7. Phase 3 — Backend : configuration

## Structure

```text
backend/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── routes/
│   ├── services/
│   ├── repositories/
│   ├── validators/
│   ├── utils/
│   ├── types/
│   ├── app.ts
│   └── server.ts
├── prisma/
│   └── schema.prisma
├── .env
└── package.json
```

## Variables d'environnement

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="..."
SMS_API_KEY="..."
SMS_API_URL="..."
SMS_SENDER="..."
PORT=5000
```

Ne jamais exposer ces valeurs dans le frontend.

---

# 8. Phase 4 — Backend : authentification

## Fonctionnalités

- inscription administrateur initiale ;
- connexion ;
- génération du JWT ;
- vérification du token ;
- gestion des rôles ;
- déconnexion côté client.

## Endpoints

```text
POST /api/auth/login
GET  /api/auth/me
```

### Middleware

```text
authenticate()
authorize("ADMIN")
authorize("TEACHER")
```

## Sécurité

- mot de passe hashé avec bcrypt ;
- JWT avec expiration ;
- validation des entrées ;
- CORS configuré ;
- variables secrètes dans `.env` ;
- aucune clé SMS dans React.

---

# 9. Phase 5 — Backend : gestion des classes

## Endpoints

```text
GET    /api/classes
GET    /api/classes/:id
POST   /api/classes
PUT    /api/classes/:id
DELETE /api/classes/:id
```

## Fonctionnalités

- créer une classe ;
- modifier une classe ;
- supprimer une classe ;
- consulter ses étudiants ;
- rechercher une classe.

---

# 10. Phase 6 — Backend : gestion des étudiants

## Endpoints

```text
GET    /api/students
GET    /api/students/:id
POST   /api/students
PUT    /api/students/:id
DELETE /api/students/:id
```

## Validation

Vérifier :

- nom non vide ;
- prénom non vide ;
- téléphone valide ;
- classe existante.

Normaliser les numéros de téléphone avant stockage.

Exemple :

```text
0700000000
```

peut être converti selon les règles du fournisseur SMS vers le format international approprié.

---

# 11. Phase 7 — Import Excel

## Frontend

Interface :

```text
+--------------------------------+
| Importer une liste d'étudiants |
|                                |
| [ Sélectionner Excel ]         |
|                                |
| Format : .xlsx / .xls          |
+--------------------------------+
```

Après sélection :

```text
Excel
  |
  v
Lecture SheetJS
  |
  v
Validation
  |
  v
Prévisualisation
  |
  v
Confirmation
```

## Format recommandé

```text
nom | prenom | telephone
```

Exemple :

```text
KOUASSI | Jean | 0700000000
YAO     | Marie| 0500000000
TRAORE  | Ibrahim | 0100000000
```

## Backend

Endpoint :

```text
POST /api/students/import
```

Le backend doit refaire les validations même si le frontend les a déjà effectuées.

## Gestion des erreurs

Afficher :

```text
Ligne 4 : téléphone invalide
Ligne 8 : prénom manquant
Ligne 12 : étudiant déjà existant
```

Ne pas importer silencieusement des données invalides.

---

# 12. Phase 8 — Backend : gestion des cours

Créer un cours avant de prendre les présences.

```text
POST /api/courses
GET  /api/courses
GET  /api/courses/:id
PUT  /api/courses/:id
```

Un cours contient :

```text
Classe
Matière
Date
Heure début
Heure fin
Enseignant
```

---

# 13. Phase 9 — Backend : gestion des présences

## Endpoint

```text
POST /api/attendance
GET  /api/attendance
GET  /api/attendance/course/:courseId
```

## Exemple de payload

```json
{
  "courseId": 12,
  "records": [
    {
      "studentId": 1,
      "status": "PRESENT"
    },
    {
      "studentId": 2,
      "status": "ABSENT"
    }
  ]
}
```

Le backend doit empêcher :

- deux présences pour le même étudiant et le même cours ;
- une présence sur un cours inexistant ;
- un étudiant qui n'appartient pas à la classe du cours.

---

# 14. Phase 10 — Backend : système SMS

Créer un service indépendant :

```text
SmsService
```

Il doit gérer :

```text
sendSms()
checkStatus()
handleProviderError()
```

Architecture :

```text
AttendanceService
       |
       v
NotificationService
       |
       v
SmsService
       |
       v
SMS Provider
```

Ne mets jamais directement les appels SMS dans les controllers.

## Flux

```text
Absence enregistrée
       |
       v
Vérification numéro
       |
       v
Création notification
       |
       v
Envoi SMS
       |
       +---- succès ----> SENT
       |
       +---- échec -----> FAILED
```

## Exemple de message

```text
Bonjour, l'étudiant Jean KOUASSI a été
signalé absent au cours de Réseaux du
13/09/2026 à 08:00.
```

Le message doit rester court et professionnel.

---

# 15. Phase 11 — Backend : historique SMS

## Endpoint

```text
GET /api/notifications
GET /api/notifications/:id
POST /api/notifications/:id/retry
```

## Statuts

```text
PENDING
SENT
FAILED
```

L'enseignant doit pouvoir voir :

```text
Jean KOUASSI
0700000000
Absent
SMS : Envoyé
13/09/2026 08:05
```

ou :

```text
SMS : Échec
Erreur : numéro invalide
```

---

# 16. Phase 12 — Frontend : authentification

Pages :

```text
/login
```

Interface :

```text
Email
[________________]

Mot de passe
[________________]

[ Se connecter ]
```

Après connexion :

```text
/dashboard
```

Protéger les routes privées.

---

# 17. Phase 13 — Frontend : Dashboard

Afficher :

```text
Dashboard

Classes             8
Étudiants         246
Absences aujourd'hui 12
SMS envoyés        37
SMS échoués         2
```

Ajouter éventuellement :

- taux de présence ;
- absences récentes ;
- dernières notifications.

---

# 18. Phase 14 — Frontend : gestion des classes

Pages :

```text
/classes
/classes/:id
```

Fonctions :

- liste ;
- recherche ;
- création ;
- modification ;
- suppression ;
- accès aux étudiants.

---

# 19. Phase 15 — Frontend : étudiants

Page :

```text
/classes/:id/students
```

Table :

```text
Nom | Prénom | Téléphone | Statut
```

Actions :

```text
Modifier
Supprimer
Voir historique
```

---

# 20. Phase 16 — Frontend : import Excel

Créer un composant réutilisable :

```text
ExcelImporter
```

Étapes UI :

```text
1. Sélection du fichier
        ↓
2. Lecture
        ↓
3. Validation
        ↓
4. Prévisualisation
        ↓
5. Confirmation
        ↓
6. Import
```

Prévoir un bouton :

```text
Télécharger le modèle Excel
```

---

# 21. Phase 17 — Frontend : prise de présence

Page principale de l'application :

```text
/attendance
```

Sélection :

```text
Classe
[ L2 Réseaux ▼ ]

Cours
[ Réseaux ▼ ]

Date
[ 13/09/2026 ]

Heure
[ 08:00 ]
```

Puis :

```text
------------------------------------------------
Étudiant              Présent   Absent   Retard
------------------------------------------------
KOUASSI Jean             ●
YAO Marie                          ●
TRAORE Ibrahim           ●
------------------------------------------------

[ Enregistrer ]
```

Après enregistrement :

```text
12 présents
3 absents
1 retard
```

---

# 22. Phase 18 — Frontend : notifications

Après l'enregistrement :

```text
Absences détectées : 3

Jean KOUASSI       0700000000
Marie YAO          0500000000
Ibrahim TRAORE     0100000000

[ Envoyer les notifications ]
```

Avant l'envoi, afficher une confirmation claire.

Après l'envoi :

```text
3 SMS

2 envoyés
1 échec
```

Permettre :

```text
[ Réessayer les échecs ]
```

---

# 23. Phase 19 — Frontend : historique

Page :

```text
/history
```

Filtres :

```text
Classe
Étudiant
Date
Statut
Type de notification
```

Table :

```text
Date | Étudiant | Statut | SMS | Heure
```

---

# 24. Phase 20 — Gestion des erreurs

Frontend :

```text
400 → données invalides
401 → non authentifié
403 → accès refusé
404 → ressource inexistante
409 → conflit
500 → erreur serveur
```

Afficher des messages compréhensibles.

Exemple :

```text
Impossible d'envoyer le SMS.
Le numéro de téléphone est invalide.
```

Ne jamais afficher :

```text
Error: AxiosError 500...
```

à l'utilisateur final.

---

# 25. Phase 21 — Tests

## Backend

Tester :

- authentification ;
- création de classe ;
- import Excel ;
- création étudiant ;
- création cours ;
- présence ;
- absence ;
- SMS ;
- erreurs ;
- permissions.

## Frontend

Tester :

- formulaire de connexion ;
- import Excel ;
- tableau de présence ;
- filtres ;
- affichage des erreurs ;
- responsive mobile.

## Tests critiques

```text
Un étudiant absent
        ↓
Une seule absence enregistrée
        ↓
Un seul SMS envoyé
        ↓
Un seul SmsLog créé
```

Tester également le double clic sur le bouton d'envoi.

---

# 26. Phase 22 — Sécurité

À traiter avant la mise en production.

## Backend

- validation systématique des payloads ;
- authentification JWT ;
- autorisation par rôle ;
- hash des mots de passe ;
- rate limiting ;
- CORS restrictif ;
- logs serveur ;
- protection contre les injections ;
- variables secrètes hors Git.

## SMS

Limiter les abus :

```text
1 absence
    ↓
1 notification
```

Empêcher qu'un utilisateur puisse déclencher des milliers de SMS volontairement ou accidentellement.

## Base de données

Faire des sauvegardes régulières.

---

# 27. Phase 23 — Déploiement

## Frontend

```text
GitHub
   ↓
Vercel
   ↓
Application web
```

## Backend

```text
GitHub
   ↓
Render / Railway
   ↓
API
```

## Database

```text
Neon / Supabase
   ↓
PostgreSQL
```

Architecture finale :

```text
                  INTERNET
                     |
                     v
              +-------------+
              |   Vercel    |
              |   React     |
              +------+------+
                     |
                     | HTTPS
                     v
              +-------------+
              | Render      |
              | Node/Express|
              +------+------+
                     |
              +------+------+
              |             |
              v             v
        PostgreSQL       SMS API
        Neon/Supabase
```

---

# 28. Ordre exact de développement

Ne développe pas frontend et backend de manière désordonnée.

## Sprint 1 — Fondations

```text
[ ] Git repository
[ ] Frontend React
[ ] Backend Express
[ ] TypeScript
[ ] PostgreSQL
[ ] Prisma
[ ] Variables .env
```

## Sprint 2 — Authentification

```text
[ ] User model
[ ] Login API
[ ] JWT
[ ] Middleware auth
[ ] Protected routes
[ ] Login frontend
```

## Sprint 3 — Classes

```text
[ ] Class model
[ ] CRUD API
[ ] Pages classes
[ ] Formulaire création
[ ] Modification
[ ] Suppression
```

## Sprint 4 — Étudiants

```text
[ ] Student model
[ ] CRUD API
[ ] Liste étudiants
[ ] Recherche
[ ] Modification
[ ] Suppression
```

## Sprint 5 — Excel

```text
[ ] SheetJS
[ ] Upload
[ ] Parsing
[ ] Validation
[ ] Preview
[ ] Import API
[ ] Gestion erreurs
```

## Sprint 6 — Cours

```text
[ ] Course model
[ ] API
[ ] Création cours
[ ] Sélection classe
[ ] Sélection date/heure
```

## Sprint 7 — Présences

```text
[ ] Attendance model
[ ] API
[ ] Interface présence
[ ] Présent
[ ] Absent
[ ] Retard
[ ] Justifié
```

## Sprint 8 — SMS

```text
[ ] Choix fournisseur
[ ] SmsService
[ ] NotificationService
[ ] Envoi SMS
[ ] SmsLog
[ ] Gestion erreurs
[ ] Retry
```

## Sprint 9 — Historique

```text
[ ] Historique absences
[ ] Historique SMS
[ ] Filtres
[ ] Recherche
[ ] Statistiques
```

## Sprint 10 — Sécurité et production

```text
[ ] Rate limiting
[ ] CORS
[ ] Validation
[ ] Logs
[ ] Tests
[ ] Backup DB
[ ] HTTPS
[ ] Déploiement
```

---

# 29. Structure finale du frontend

```text
src/
├── components/
│   ├── Button/
│   ├── Input/
│   ├── Modal/
│   ├── Table/
│   ├── Badge/
│   └── Loading/
│
├── layouts/
│   ├── DashboardLayout.tsx
│   └── AuthLayout.tsx
│
├── pages/
│   ├── Login/
│   ├── Dashboard/
│   ├── Classes/
│   ├── Students/
│   ├── Import/
│   ├── Courses/
│   ├── Attendance/
│   ├── Notifications/
│   └── History/
│
├── features/
│   ├── auth/
│   ├── classes/
│   ├── students/
│   ├── courses/
│   ├── attendance/
│   └── notifications/
│
├── services/
│   ├── api.ts
│   ├── auth.service.ts
│   ├── class.service.ts
│   ├── student.service.ts
│   ├── course.service.ts
│   ├── attendance.service.ts
│   └── notification.service.ts
│
├── schemas/
├── types/
├── hooks/
├── utils/
└── routes/
```

---

# 30. Structure finale du backend

```text
src/
├── config/
│   ├── database.ts
│   └── env.ts
│
├── controllers/
│   ├── auth.controller.ts
│   ├── class.controller.ts
│   ├── student.controller.ts
│   ├── course.controller.ts
│   ├── attendance.controller.ts
│   └── notification.controller.ts
│
├── services/
│   ├── auth.service.ts
│   ├── class.service.ts
│   ├── student.service.ts
│   ├── course.service.ts
│   ├── attendance.service.ts
│   ├── notification.service.ts
│   └── sms.service.ts
│
├── routes/
│   ├── auth.routes.ts
│   ├── class.routes.ts
│   ├── student.routes.ts
│   ├── course.routes.ts
│   ├── attendance.routes.ts
│   └── notification.routes.ts
│
├── middlewares/
│   ├── auth.middleware.ts
│   ├── role.middleware.ts
│   └── error.middleware.ts
│
├── validators/
├── utils/
├── types/
├── app.ts
└── server.ts
```

---

# 31. API finale

```text
AUTH
POST   /api/auth/login
GET    /api/auth/me

CLASSES
GET    /api/classes
POST   /api/classes
GET    /api/classes/:id
PUT    /api/classes/:id
DELETE /api/classes/:id

STUDENTS
GET    /api/students
POST   /api/students
GET    /api/students/:id
PUT    /api/students/:id
DELETE /api/students/:id
POST   /api/students/import

COURSES
GET    /api/courses
POST   /api/courses
GET    /api/courses/:id
PUT    /api/courses/:id
DELETE /api/courses/:id

ATTENDANCE
GET    /api/attendance
POST   /api/attendance
GET    /api/attendance/course/:courseId

NOTIFICATIONS
GET    /api/notifications
GET    /api/notifications/:id
POST   /api/notifications/:id/retry
```

---

# 32. MVP à terminer en premier

Le premier objectif ne doit pas être le dashboard.

Le parcours critique est :

```text
Connexion
   ↓
Créer/importer une classe
   ↓
Importer Excel
   ↓
Voir les étudiants
   ↓
Créer un cours
   ↓
Marquer les absents
   ↓
Enregistrer les absences
   ↓
Envoyer les SMS
   ↓
Voir le résultat de l'envoi
```

Si ce parcours fonctionne correctement, le produit possède déjà son cœur fonctionnel.

Tout le reste est secondaire pour le premier MVP.

---

# 33. Évolutions après le MVP

Une fois le MVP stable :

```text
V2
├── Gestion des retards
├── Absences justifiées
├── Statistiques
├── Export Excel
├── Export PDF
├── Historique étudiant
└── Recherche avancée

V3
├── Notifications automatiques
├── SMS groupés
├── Email
├── WhatsApp Business API
├── Portail parent
└── Application mobile

V4
├── Détection automatique des anomalies
├── Prédiction du risque d'absentéisme
├── Analytics
├── Multi-établissements
└── SaaS multi-tenant
```

## Priorité technique

```text
1. Base de données
2. API backend
3. Authentification
4. Classes / étudiants
5. Import Excel
6. Cours / présences
7. SMS
8. Frontend complet
9. Tests
10. Sécurité
11. Déploiement
12. Fonctionnalités avancées
```

Le point architectural le plus important est de **séparer `AttendanceService`, `NotificationService` et `SmsService`**. Cela permet de remplacer le fournisseur SMS sans réécrire le système de présence, et permet plus tard d'ajouter email ou WhatsApp sans dégrader l'architecture.
