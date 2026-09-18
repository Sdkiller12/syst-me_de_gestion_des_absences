# PROMPT — Développement complet d'une application Web de gestion des absences et notifications SMS

## 1. Rôle

Tu es un développeur Full-Stack senior spécialisé en :

- React + TypeScript
- Node.js + Express
- PostgreSQL
- Prisma ORM
- REST API
- UX/UI moderne
- sécurité applicative
- intégration d'API SMS

Tu dois développer une application web complète, fonctionnelle et maintenable permettant à un établissement scolaire ou universitaire de gérer les présences/absences des étudiants et d'envoyer automatiquement des SMS aux contacts téléphoniques associés.

Ne te contente pas de produire une maquette.

L'application doit être réellement fonctionnelle, exécutable localement et structurée pour pouvoir être déployée en production.

---

# 2. Objectif de l'application

L'application doit permettre à un enseignant ou administrateur de :

1. créer et gérer des classes ;
2. importer une liste d'étudiants depuis un fichier Excel ;
3. stocker :
   - nom ;
   - prénom ;
   - numéro de téléphone ;
   - classe ;
4. créer une séance de cours ;
5. afficher les étudiants de la classe ;
6. marquer leur présence, absence, retard ou absence justifiée ;
7. enregistrer les présences ;
8. identifier automatiquement les étudiants absents ;
9. envoyer un SMS au numéro associé à chaque étudiant absent ;
10. enregistrer le résultat de chaque notification ;
11. consulter l'historique des absences ;
12. consulter l'historique des SMS ;
13. rechercher et filtrer les données ;
14. gérer les utilisateurs selon leurs rôles.

---

# 3. Stack technique obligatoire

## Frontend

Utiliser :

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Axios
- TanStack Query
- React Hook Form
- Zod
- SheetJS (`xlsx`)

## Backend

Utiliser :

- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL
- JWT
- bcrypt
- Zod

## Architecture API

Utiliser une API REST JSON.

Toutes les communications frontend/backend doivent utiliser HTTPS en production.

---

# 4. Architecture du projet

Créer un projet avec cette structure :

```text
attendance-sms/
│
├── frontend/
│
└── backend/
Frontend
frontend/
├── src/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   ├── features/
│   ├── hooks/
│   ├── services/
│   ├── schemas/
│   ├── types/
│   ├── utils/
│   ├── routes/
│   ├── App.tsx
│   └── main.tsx
│
├── public/
├── .env
└── package.json
Backend
backend/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── routes/
│   ├── middlewares/
│   ├── validators/
│   ├── utils/
│   ├── types/
│   ├── app.ts
│   └── server.ts
│
├── prisma/
│   └── schema.prisma
│
├── .env
└── package.json
5. Modèle de données

Créer une base PostgreSQL avec Prisma.

User
id
name
email
passwordHash
role
createdAt
updatedAt

Roles :

ADMIN
TEACHER
Class
id
name
academicYear
createdAt
updatedAt
Student
id
classId
firstName
lastName
phone
createdAt
updatedAt

Relations :

Class 1 ─── N Student
Course
id
classId
teacherId
subject
date
startTime
endTime
createdAt
updatedAt
Attendance
id
courseId
studentId
status
recordedAt
recordedBy

Statuses :

PRESENT
ABSENT
LATE
JUSTIFIED

Créer une contrainte empêchant plusieurs enregistrements de présence pour le même étudiant dans le même cours.

SmsLog
id
studentId
attendanceId
phone
message
status
providerMessageId
errorMessage
sentAt

Statuses :

PENDING
SENT
FAILED
6. Authentification

Implémenter :

POST /api/auth/login
GET  /api/auth/me

Utiliser :

bcrypt pour les mots de passe ;
JWT pour l'authentification ;
middleware authenticate;
middleware authorize.

Exemple :

ADMIN
├── gérer utilisateurs
├── gérer classes
├── gérer étudiants
└── consulter toutes les données

TEACHER
├── consulter ses classes
├── créer des cours
├── enregistrer les présences
└── envoyer les notifications

Ne jamais stocker les mots de passe en clair.

7. Gestion des classes

Créer les endpoints :

GET    /api/classes
GET    /api/classes/:id
POST   /api/classes
PUT    /api/classes/:id
DELETE /api/classes/:id

Frontend :

/classes
/classes/:id

Permettre :

création ;
modification ;
suppression ;
recherche ;
consultation des étudiants.
8. Gestion des étudiants

Créer :

GET    /api/students
GET    /api/students/:id
POST   /api/students
PUT    /api/students/:id
DELETE /api/students/:id

Permettre :

recherche par nom ;
filtre par classe ;
modification ;
suppression ;
consultation de l'historique.

Valider systématiquement :

firstName
lastName
phone
classId

Le numéro de téléphone doit être normalisé avant stockage.

9. Import Excel

L'application doit permettre d'importer un fichier :

.xlsx
.xls

Format attendu :

nom | prenom | telephone

Exemple :

KOUASSI | Jean | 0700000000
YAO | Marie | 0500000000
TRAORE | Ibrahim | 0100000000

Utiliser SheetJS côté frontend pour lire le fichier.

Processus :

Sélection fichier
       ↓
Lecture Excel
       ↓
Validation
       ↓
Détection erreurs
       ↓
Prévisualisation
       ↓
Confirmation
       ↓
Envoi backend
       ↓
Validation backend
       ↓
Insertion PostgreSQL

Afficher les erreurs par ligne :

Ligne 4 : numéro invalide
Ligne 7 : prénom manquant
Ligne 10 : étudiant déjà existant

Ajouter :

[ Télécharger le modèle Excel ]
10. Gestion des cours

Créer :

GET    /api/courses
GET    /api/courses/:id
POST   /api/courses
PUT    /api/courses/:id
DELETE /api/courses/:id

Un cours doit contenir :

Classe
Matière
Enseignant
Date
Heure début
Heure fin
11. Gestion des présences

Créer :

GET  /api/attendance
POST /api/attendance
GET  /api/attendance/course/:courseId

L'interface doit permettre de sélectionner :

Classe
Cours
Date
Heure

Puis afficher :

------------------------------------------------
Étudiant          Présent  Absent  Retard
------------------------------------------------
KOUASSI Jean         ●
YAO Marie                     ●
TRAORE Ibrahim       ●
------------------------------------------------

Prévoir également :

JUSTIFIED
12. Enregistrement des présences

Payload :

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

Le backend doit vérifier :

que le cours existe ;
que l'étudiant existe ;
que l'étudiant appartient à la classe ;
qu'il n'existe pas déjà une présence ;
que le statut est valide.
13. Système SMS

Créer une architecture indépendante :

AttendanceService
        ↓
NotificationService
        ↓
SmsService
        ↓
SMS Provider

Ne jamais placer directement la logique SMS dans les controllers.

Créer :

sendSms()

Le fournisseur SMS doit être configurable via .env.

Exemple :

SMS_API_URL=
SMS_API_KEY=
SMS_SENDER=

Ne jamais exposer ces informations dans React.

14. Déclenchement des notifications

Après l'enregistrement des présences :

Présences enregistrées
        ↓
Identifier ABSENT
        ↓
Récupérer téléphone
        ↓
Créer SmsLog PENDING
        ↓
Envoyer SMS
        ↓
SENT ou FAILED

Ne jamais envoyer deux SMS pour la même absence par erreur.

Gérer le double clic sur le bouton d'envoi.

Prévoir un mécanisme d'idempotence.

15. Contenu du SMS

Utiliser un message configurable.

Exemple :

Bonjour, l'étudiant {{firstName}} {{lastName}}
a été signalé absent au cours de {{subject}}
le {{date}} à {{time}}.

Créer un système permettant de modifier ultérieurement le modèle du message.

16. Historique des SMS

Créer :

GET /api/notifications
GET /api/notifications/:id
POST /api/notifications/:id/retry

Afficher :

Étudiant
Téléphone
Date
Message
Statut
Erreur éventuelle

Exemple :

Jean KOUASSI
0700000000
SMS : SENT
13/09/2026 08:05

En cas d'échec :

SMS : FAILED
Erreur : numéro invalide

Ajouter :

[ Réessayer ]
17. Dashboard frontend

Créer :

/dashboard

Afficher :

Classes
Étudiants
Absences aujourd'hui
SMS envoyés
SMS échoués

Ajouter :

absences récentes ;
dernières notifications ;
taux de présence ;
graphiques simples.

Ne pas surcharger l'interface.

18. Pages frontend

Créer au minimum :

/login

/dashboard

/classes

/classes/:id

/students

/courses

/attendance

/notifications

/history

/profile
19. Design UI/UX

Créer une interface :

professionnelle ;
moderne ;
claire ;
responsive ;
adaptée desktop et mobile ;
accessible ;
avec une hiérarchie visuelle nette.

Utiliser Tailwind CSS.

Prévoir :

Sidebar
Topbar
Cards
Tables
Forms
Modals
Badges
Toast notifications
Loading states
Empty states
Error states

Pour les tableaux sur mobile, prévoir une présentation adaptée plutôt qu'un tableau illisible.

20. Gestion des états

Utiliser TanStack Query pour :

récupération des classes ;
récupération des étudiants ;
cours ;
présences ;
notifications.

Gérer systématiquement :

Loading
Success
Empty
Error

Exemple :

Chargement...
Aucune classe trouvée.
Erreur lors du chargement.
21. Validation frontend

Utiliser :

React Hook Form
+
Zod

Valider :

email ;
mot de passe ;
nom ;
prénom ;
téléphone ;
classe ;
cours ;
présence.

Mais ne jamais considérer la validation frontend comme suffisante.

Le backend doit toujours revalider.

22. API client frontend

Créer :

services/api.ts

Configurer Axios avec :

baseURL
Authorization
interceptors
error handling

Le token JWT doit être géré de manière sécurisée.

Ne jamais mettre de secrets backend dans le frontend.

23. Gestion des erreurs API

Utiliser les codes :

400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
500 Internal Server Error

Retour API standardisé :

{
  "success": false,
  "message": "Le numéro de téléphone est invalide",
  "errors": []
}
24. Sécurité backend

Implémenter :

CORS ;
validation Zod ;
rate limiting ;
Helmet ;
authentification JWT ;
autorisation par rôle ;
bcrypt ;
logs ;
gestion centralisée des erreurs ;
protection contre les injections ;
variables d'environnement ;
HTTPS en production.

Ne jamais retourner :

mot de passe ;
hash ;
clé API ;
secret JWT.
25. Dashboard et statistiques

Prévoir des statistiques :

Nombre total étudiants
Nombre présents
Nombre absents
Nombre de retards
Taux de présence
Nombre SMS envoyés
Nombre SMS échoués

Filtres :

Aujourd'hui
Cette semaine
Ce mois
Période personnalisée
26. Tests

Créer des tests backend pour :

Auth
Classes
Students
Import Excel
Courses
Attendance
SMS
Notifications
Permissions

Cas critique :

Étudiant absent
      ↓
1 absence
      ↓
1 notification
      ↓
1 SMS

Tester également :

double clic
numéro invalide
SMS échoué
étudiant inexistant
cours inexistant
utilisateur non autorisé
27. Documentation

Créer :

README.md

Documenter :

architecture ;
installation ;
variables d'environnement ;
installation PostgreSQL ;
migration Prisma ;
lancement frontend ;
lancement backend ;
format Excel ;
configuration SMS ;
API ;
déploiement.

Ajouter des exemples de commandes.

28. Variables d'environnement

Backend :

DATABASE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=
SMS_API_URL=
SMS_API_KEY=
SMS_SENDER=
PORT=
FRONTEND_URL=

Frontend :

VITE_API_URL=

Créer également :

.env.example

Ne jamais commit .env.

29. Scripts npm

Frontend :

npm run dev
npm run build
npm run preview

Backend :

npm run dev
npm run build
npm run start
npm run test

Prisma :

npx prisma generate
npx prisma migrate dev
npx prisma studio
30. Développement par étapes

Ne tente pas de développer tout le système simultanément.

Respecter cet ordre :

Étape 1

Initialisation :

Frontend
Backend
TypeScript
PostgreSQL
Prisma
Étape 2
Base de données
Étape 3
Authentification
Étape 4
Classes
Étape 5
Étudiants
Étape 6
Import Excel
Étape 7
Cours
Étape 8
Présences
Étape 9
SMS
Étape 10
Historique
Étape 11
Dashboard
Étape 12
Tests
Sécurité
Optimisation
Étape 13
Déploiement
31. Règles de développement

Tu dois :

écrire du code réellement exécutable ;
éviter les fichiers inutilement complexes ;
respecter la séparation des responsabilités ;
utiliser TypeScript correctement ;
éviter any sauf nécessité justifiée ;
créer des composants réutilisables ;
centraliser les appels API ;
centraliser la gestion des erreurs ;
séparer controllers, services et repositories ;
documenter les choix techniques importants.

Ne crée pas de fausses fonctionnalités.

Ne simule pas l'envoi SMS avec un simple console.log dans la version finale.

Si les identifiants du fournisseur SMS ne sont pas disponibles pendant le développement, créer une abstraction SmsProvider et un mode mock explicitement séparé du mode production.

32. Critères d'acceptation

L'application est considérée comme fonctionnelle uniquement si le scénario suivant fonctionne :

1. Connexion
        ↓
2. Création d'une classe
        ↓
3. Import d'un fichier Excel
        ↓
4. Affichage des étudiants
        ↓
5. Création d'un cours
        ↓
6. Affichage de la liste
        ↓
7. Marquage des absents
        ↓
8. Enregistrement
        ↓
9. Détection des absents
        ↓
10. Envoi SMS
        ↓
11. Enregistrement SmsLog
        ↓
12. Affichage du statut
        ↓
13. Consultation historique
33. Déploiement

Préparer le projet pour :

Frontend → Vercel
Backend → Render ou Railway
Database → Neon ou Supabase

Prévoir :

Production environment
Development environment

Ne pas mélanger les configurations.

34. Livrables attendus

À la fin du développement, fournir :

attendance-sms/
│
├── frontend/
├── backend/
├── README.md
├── .gitignore
└── .env.example

Le projet doit pouvoir être cloné puis installé avec :

npm install

dans chaque partie.

Il doit pouvoir être lancé localement avec :

npm run dev
35. Méthode de travail obligatoire

Développer fonctionnalité par fonctionnalité.

Pour chaque fonctionnalité :

1. Concevoir
2. Créer le modèle Prisma si nécessaire
3. Créer le service backend
4. Créer le controller
5. Créer les routes
6. Tester l'API
7. Créer le service frontend
8. Créer l'interface
9. Connecter frontend/backend
10. Tester le flux complet

Ne passe pas à la fonctionnalité suivante si la précédente ne fonctionne pas.

À chaque étape, indiquer :

- fichiers créés ;
- fichiers modifiés ;
- commandes à exécuter ;
- dépendances installées ;
- fonctionnalité terminée ;
- éventuelles erreurs restantes.
36. Priorité absolue

Le cœur du produit est :

EXCEL
  ↓
ÉTUDIANTS
  ↓
COURS
  ↓
PRÉSENCE
  ↓
ABSENCE
  ↓
SMS
  ↓
HISTORIQUE

Tout développement doit préserver ce parcours.

Ne commence pas par des fonctionnalités secondaires ou par des animations.

La priorité est :

Fiabilité
+
Sécurité
+
Simplicité
+
Maintenabilité
+
UX