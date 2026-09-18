# PROMPT — Développement Backend complet d'une application Web de gestion des absences et notifications SMS

## 1. Rôle

Tu es un développeur Backend senior spécialisé en :

- Node.js
- TypeScript
- Express.js
- PostgreSQL
- Prisma ORM
- API REST
- authentification JWT
- sécurité applicative
- intégration d'API SMS

Tu dois développer **uniquement le backend** d'une application web de gestion des présences, absences et notifications SMS.

Le frontend sera développé séparément en React + TypeScript.

**Ne développe aucun frontend.**

Le backend doit fournir une API REST propre, documentée, sécurisée et prête à être consommée par une application React.

---

# 2. Objectif

L'API doit permettre à un établissement scolaire ou universitaire de :

- gérer les utilisateurs ;
- gérer les classes ;
- gérer les étudiants ;
- importer des étudiants depuis Excel ;
- créer des cours ;
- enregistrer les présences ;
- enregistrer les absences ;
- gérer les retards et absences justifiées ;
- identifier les étudiants absents ;
- envoyer des SMS aux contacts associés ;
- enregistrer les résultats des SMS ;
- réessayer les SMS échoués ;
- consulter l'historique ;
- obtenir des statistiques pour le dashboard.

---

# 3. Stack obligatoire

Utiliser :

```text
Node.js
TypeScript
Express.js
PostgreSQL
Prisma ORM
JWT
bcrypt
Zod
```

Ajouter :

```text
Helmet
CORS
express-rate-limit
Pino ou Winston
```

Pour les tests :

```text
Vitest ou Jest
Supertest
```

Pour l'import Excel côté backend :

```text
SheetJS (xlsx)
```

---

# 4. Architecture

Créer :

```text
attendance-sms/
│
└── backend/
    ├── src/
    │   ├── config/
    │   ├── controllers/
    │   ├── services/
    │   ├── repositories/
    │   ├── routes/
    │   ├── middlewares/
    │   ├── validators/
    │   ├── providers/
    │   ├── utils/
    │   ├── types/
    │   ├── constants/
    │   ├── app.ts
    │   └── server.ts
    │
    ├── prisma/
    │   ├── schema.prisma
    │   └── seed.ts
    │
    ├── tests/
    ├── .env
    ├── .env.example
    ├── .gitignore
    ├── tsconfig.json
    ├── package.json
    └── README.md
```

---

# 5. Principe d'architecture

Respecter strictement :

```text
HTTP Request
     ↓
Route
     ↓
Middleware
     ↓
Controller
     ↓
Service
     ↓
Repository
     ↓
Prisma
     ↓
PostgreSQL
```

Pour les SMS :

```text
AttendanceService
       ↓
NotificationService
       ↓
SmsService
       ↓
SmsProvider
       ↓
External SMS API
```

Les controllers ne doivent contenir aucune logique métier importante.

---

# 6. Configuration

Créer un système centralisé de configuration.

Variables :

```env
NODE_ENV=development
PORT=5000

DATABASE_URL=

JWT_SECRET=
JWT_EXPIRES_IN=

FRONTEND_URL=

SMS_API_URL=
SMS_API_KEY=
SMS_SENDER=

LOG_LEVEL=
```

Créer :

```text
src/config/env.ts
```

Valider les variables d'environnement au démarrage.

Si une variable critique manque, l'application doit refuser de démarrer avec un message explicite.

---

# 7. Base de données PostgreSQL

Utiliser Prisma.

Créer les modèles suivants.

---

# 8. Modèle User

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

Role :

```text
ADMIN
TEACHER
```

Contraintes :

```text
email UNIQUE
```

Ne jamais retourner `passwordHash` dans les réponses API.

---

# 9. Modèle Class

```text
Class
├── id
├── name
├── academicYear
├── createdAt
└── updatedAt
```

Relations :

```text
Class
 ├── Students
 ├── Courses
 └── Attendances indirectement
```

Prévoir une contrainte logique empêchant les doublons incohérents.

---

# 10. Modèle Student

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

Relations :

```text
Class 1 ─── N Student
Student 1 ─── N Attendance
Student 1 ─── N SmsLog
```

Le numéro doit être normalisé avant stockage.

Exemple :

```text
0700000000
```

doit être transformé dans le format international attendu par le fournisseur SMS.

Ne jamais supposer qu'un numéro est valide simplement parce qu'il contient dix chiffres.

---

# 11. Modèle Course

```text
Course
├── id
├── classId
├── teacherId
├── subject
├── date
├── startTime
├── endTime
├── createdAt
└── updatedAt
```

Relations :

```text
Class 1 ─── N Course
User 1 ─── N Course
Course 1 ─── N Attendance
```

---

# 12. Modèle Attendance

```text
Attendance
├── id
├── courseId
├── studentId
├── status
├── recordedAt
├── recordedBy
├── createdAt
└── updatedAt
```

Status :

```text
PRESENT
ABSENT
LATE
JUSTIFIED
```

Créer une contrainte unique :

```text
courseId + studentId
```

Un étudiant ne peut avoir qu'un seul état de présence pour un cours donné.

---

# 13. Modèle SmsLog

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
├── sentAt
├── createdAt
└── updatedAt
```

Status :

```text
PENDING
SENT
FAILED
```

Conserver l'identifiant retourné par le fournisseur SMS.

---

# 14. Relations Prisma

Construire les relations :

```text
User
 └── Courses

Class
 ├── Students
 └── Courses

Student
 ├── Attendances
 └── SmsLogs

Course
 └── Attendances

Attendance
 └── SmsLogs
```

Configurer correctement :

- foreign keys ;
- indexes ;
- cascade ;
- contraintes uniques.

---

# 15. Migrations

Utiliser :

```bash
npx prisma migrate dev
npx prisma generate
```

Créer un seed :

```text
prisma/seed.ts
```

Le seed doit créer :

```text
1 administrateur
1 enseignant
quelques classes
quelques étudiants
quelques cours
quelques présences
quelques notifications
```

Les données doivent être fictives.

---

# 16. Authentification

Créer :

```text
POST /api/auth/login
GET  /api/auth/me
```

Login :

```json
{
  "email": "admin@example.com",
  "password": "password"
}
```

Réponse :

```json
{
  "success": true,
  "data": {
    "user": {},
    "token": "..."
  }
}
```

Utiliser :

```text
bcrypt
JWT
```

Le JWT doit contenir uniquement les informations nécessaires :

```text
userId
role
```

Ajouter une expiration.

---

# 17. Middleware d'authentification

Créer :

```text
authenticate()
```

Responsabilités :

1. récupérer le token ;
2. vérifier le JWT ;
3. récupérer l'utilisateur ;
4. injecter l'utilisateur dans `req`.

Si invalide :

```text
401 Unauthorized
```

---

# 18. Middleware d'autorisation

Créer :

```text
authorize(...roles)
```

Exemple :

```text
authorize("ADMIN")
```

ou :

```text
authorize("ADMIN", "TEACHER")
```

Si l'utilisateur n'a pas le droit :

```text
403 Forbidden
```

---

# 19. API Classes

Créer :

```text
GET    /api/classes
GET    /api/classes/:id
POST   /api/classes
PUT    /api/classes/:id
DELETE /api/classes/:id
```

Fonctionnalités :

- pagination ;
- recherche ;
- filtre année académique ;
- nombre d'étudiants ;
- validation.

Exemple :

```text
GET /api/classes?page=1&limit=20&search=RT
```

---

# 20. API Students

Créer :

```text
GET    /api/students
GET    /api/students/:id
POST   /api/students
PUT    /api/students/:id
DELETE /api/students/:id
```

Filtres :

```text
classId
search
page
limit
```

Exemple :

```text
GET /api/students?classId=3&search=KOUASSI
```

---

# 21. Import Excel

Créer :

```text
POST /api/students/import
```

Recevoir un fichier multipart/form-data.

Formats :

```text
.xlsx
.xls
```

Colonnes attendues :

```text
nom
prenom
telephone
```

Processus :

```text
Upload
 ↓
Validation fichier
 ↓
Lecture Excel
 ↓
Validation colonnes
 ↓
Validation lignes
 ↓
Normalisation
 ↓
Détection doublons
 ↓
Transaction PostgreSQL
 ↓
Rapport d'import
```

Réponse :

```json
{
  "success": true,
  "data": {
    "imported": 120,
    "failed": 5,
    "errors": [
      {
        "row": 4,
        "message": "Numéro de téléphone invalide"
      }
    ]
  }
}
```

Ne jamais effectuer un import partiel silencieux.

Utiliser une transaction lorsque cela est approprié.

---

# 22. Gestion des doublons

Définir une stratégie claire.

Détecter notamment :

```text
même étudiant
même numéro
doublon dans le fichier
étudiant déjà présent dans la classe
```

Retourner des erreurs explicites.

Ne jamais créer silencieusement plusieurs étudiants identiques.

---

# 23. API Courses

Créer :

```text
GET    /api/courses
GET    /api/courses/:id
POST   /api/courses
PUT    /api/courses/:id
DELETE /api/courses/:id
```

Filtres :

```text
classId
teacherId
date
startDate
endDate
```

Vérifier que :

```text
teacherId
```

correspond à un utilisateur ayant le rôle `TEACHER`.

---

# 24. API Attendance

Créer :

```text
GET /api/attendance
GET /api/attendance/course/:courseId
POST /api/attendance
PUT /api/attendance/:id
```

Payload :

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

---

# 25. Validation des présences

Avant insertion :

```text
Cours existe ?
        ↓
Utilisateur autorisé ?
        ↓
Étudiant existe ?
        ↓
Étudiant appartient à la classe ?
        ↓
Statut valide ?
        ↓
Doublon ?
        ↓
Transaction
```

Si une donnée est incohérente, retourner une erreur précise.

---

# 26. Transaction pour les présences

Lors de l'enregistrement d'une séance :

```text
BEGIN
   ↓
Créer / mettre à jour les présences
   ↓
Identifier les absents
   ↓
Créer les notifications PENDING
   ↓
COMMIT
```

Ne pas envoyer directement un SMS avant que les données de présence soient correctement enregistrées.

---

# 27. Architecture SMS

Créer :

```text
providers/
└── sms/
    ├── SmsProvider.ts
    ├── SmsProviderMock.ts
    └── SmsProviderProduction.ts
```

Interface conceptuelle :

```typescript
interface SmsProvider {
  sendSms(
    phone: string,
    message: string
  ): Promise<SmsProviderResponse>;
}
```

Le reste du backend ne doit pas dépendre directement de Twilio ou d'un autre fournisseur.

---

# 28. Service SMS

Créer :

```text
SmsService
```

Responsabilités :

- valider le numéro ;
- construire la requête ;
- appeler le fournisseur ;
- traiter la réponse ;
- gérer les erreurs ;
- retourner un résultat standardisé.

---

# 29. NotificationService

Créer :

```text
NotificationService
```

Responsabilités :

```text
createNotification()
sendNotification()
retryNotification()
getNotifications()
```

Ne pas mettre cette logique dans `AttendanceController`.

---

# 30. Déclenchement SMS

Après validation des absences :

```text
Attendance
    ↓
ABSENT
    ↓
Notification PENDING
    ↓
SmsService
    ↓
Provider
    ↓
SENT / FAILED
```

Une absence doit pouvoir être enregistrée même si le fournisseur SMS est momentanément indisponible.

C'est essentiel.

La présence et l'envoi SMS sont deux responsabilités différentes.

---

# 31. Idempotence

Empêcher l'envoi multiple d'un même SMS.

Exemple :

```text
Étudiant absent
       ↓
SMS déjà envoyé ?
       ↓
OUI → ne pas renvoyer automatiquement
NON → envoyer
```

Le système doit également résister au double appel HTTP.

---

# 32. Retry SMS

Créer :

```text
POST /api/notifications/:id/retry
```

Uniquement pour :

```text
FAILED
```

Après retry :

```text
PENDING
 ↓
SENT
```

ou :

```text
PENDING
 ↓
FAILED
```

Conserver l'erreur.

---

# 33. API Notifications

Créer :

```text
GET /api/notifications
GET /api/notifications/:id
POST /api/notifications/:id/retry
```

Filtres :

```text
status
studentId
date
classId
```

Pagination obligatoire.

---

# 34. Historique des absences

Créer :

```text
GET /api/history/attendance
```

Filtres :

```text
studentId
classId
courseId
status
startDate
endDate
```

Réponse optimisée pour alimenter le frontend.

---

# 35. Dashboard API

Créer :

```text
GET /api/dashboard/stats
```

Retourner :

```json
{
  "students": 250,
  "classes": 8,
  "todayAbsences": 14,
  "todayPresences": 230,
  "smsSent": 38,
  "smsFailed": 2
}
```

Créer éventuellement :

```text
GET /api/dashboard/attendance-chart
GET /api/dashboard/recent-absences
GET /api/dashboard/recent-notifications
```

---

# 36. Pagination

Toutes les listes potentiellement volumineuses doivent utiliser :

```text
page
limit
```

Exemple :

```text
GET /api/students?page=2&limit=20
```

Réponse :

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 125,
    "totalPages": 7
  }
}
```

Ne jamais retourner des milliers d'enregistrements inutilement.

---

# 37. Validation Zod

Créer des schemas :

```text
loginSchema
classSchema
studentSchema
courseSchema
attendanceSchema
notificationSchema
```

Toutes les données externes doivent être validées.

Sources à valider :

```text
body
params
query
files
```

---

# 38. Gestion des erreurs

Créer un middleware :

```text
errorHandler
```

Standardiser les réponses :

```json
{
  "success": false,
  "message": "Étudiant introuvable",
  "code": "STUDENT_NOT_FOUND"
}
```

Ne pas retourner les stack traces en production.

---

# 39. Codes d'erreur

Utiliser notamment :

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
STUDENT_NOT_FOUND
CLASS_NOT_FOUND
COURSE_NOT_FOUND
ATTENDANCE_ALREADY_EXISTS
SMS_SEND_FAILED
INTERNAL_ERROR
```

---

# 40. Logging

Utiliser Pino ou Winston.

Logger :

```text
HTTP requests
authentication failures
database errors
SMS failures
imports
critical business errors
```

Ne jamais logger :

```text
password
JWT_SECRET
SMS_API_KEY
tokens complets
```

---

# 41. Sécurité HTTP

Configurer :

```text
Helmet
CORS
Rate limiting
```

CORS doit autoriser uniquement le frontend configuré.

Exemple :

```env
FRONTEND_URL=https://application.example.com
```

---

# 42. Rate limiting

Protéger particulièrement :

```text
POST /api/auth/login
POST /api/notifications/:id/retry
POST /api/students/import
```

Éviter qu'un utilisateur puisse déclencher une quantité massive de SMS.

---

# 43. Protection SMS

Ajouter des règles métier :

```text
1 absence
→ 1 notification

1 notification SENT
→ pas de nouvel envoi automatique
```

Ajouter éventuellement une limite :

```text
nombre maximum de SMS par minute
```

Cette protection doit exister côté backend.

---

# 44. Gestion des numéros de téléphone

Créer :

```text
phone.utils.ts
```

Responsabilités :

```text
normalizePhone()
validatePhone()
```

Le système doit gérer les formats locaux et internationaux acceptés par le fournisseur.

Stocker de préférence le numéro dans un format international standardisé.

---

# 45. Timezone

Ne pas mélanger les heures serveur et les heures locales.

Définir explicitement la timezone métier :

```text
Africa/Abidjan
```

Stocker les dates de manière cohérente.

Lorsqu'un cours est enregistré à :

```text
08:00
```

le backend doit conserver une représentation non ambiguë de cette heure.

---

# 46. Transactions

Utiliser les transactions Prisma pour les opérations critiques :

```text
Import étudiants
Enregistrement présence
Création cours
Opérations nécessitant plusieurs écritures
```

Ne pas utiliser des transactions inutilement longues.

---

# 47. Repository Pattern

Créer des repositories :

```text
user.repository.ts
class.repository.ts
student.repository.ts
course.repository.ts
attendance.repository.ts
notification.repository.ts
```

Le repository doit gérer l'accès aux données.

Le service doit gérer la logique métier.

---

# 48. Services

Créer :

```text
auth.service.ts
class.service.ts
student.service.ts
course.service.ts
attendance.service.ts
notification.service.ts
sms.service.ts
dashboard.service.ts
```

Responsabilité :

```text
Controller
→ HTTP

Service
→ Business logic

Repository
→ Database
```

---

# 49. Controllers

Créer :

```text
auth.controller.ts
class.controller.ts
student.controller.ts
course.controller.ts
attendance.controller.ts
notification.controller.ts
dashboard.controller.ts
```

Un controller doit rester léger.

Exemple conceptuel :

```text
Controller
   ↓
validation
   ↓
service
   ↓
response
```

---

# 50. Routes

Créer :

```text
routes/
├── auth.routes.ts
├── class.routes.ts
├── student.routes.ts
├── course.routes.ts
├── attendance.routes.ts
├── notification.routes.ts
└── dashboard.routes.ts
```

Préfixe :

```text
/api
```

---

# 51. API complète

## Auth

```text
POST /api/auth/login
GET  /api/auth/me
```

## Classes

```text
GET    /api/classes
GET    /api/classes/:id
POST   /api/classes
PUT    /api/classes/:id
DELETE /api/classes/:id
```

## Étudiants

```text
GET    /api/students
GET    /api/students/:id
POST   /api/students
PUT    /api/students/:id
DELETE /api/students/:id
POST   /api/students/import
```

## Cours

```text
GET    /api/courses
GET    /api/courses/:id
POST   /api/courses
PUT    /api/courses/:id
DELETE /api/courses/:id
```

## Présences

```text
GET /api/attendance
GET /api/attendance/course/:courseId
POST /api/attendance
PUT /api/attendance/:id
```

## Notifications

```text
GET  /api/notifications
GET  /api/notifications/:id
POST /api/notifications/:id/retry
```

## Dashboard

```text
GET /api/dashboard/stats
GET /api/dashboard/attendance-chart
GET /api/dashboard/recent-absences
GET /api/dashboard/recent-notifications
```

---

# 52. Documentation API

Documenter l'API avec :

```text
OpenAPI / Swagger
```

Créer :

```text
/api/docs
```

Documenter :

- endpoints ;
- paramètres ;
- payloads ;
- réponses ;
- erreurs ;
- authentification ;
- exemples.

---

# 53. Tests unitaires

Tester :

```text
AuthService
ClassService
StudentService
CourseService
AttendanceService
NotificationService
SmsService
PhoneUtils
```

---

# 54. Tests d'intégration

Tester :

```text
POST /auth/login
POST /classes
POST /students
POST /students/import
POST /courses
POST /attendance
GET /notifications
POST /notifications/:id/retry
```

---

# 55. Scénarios critiques à tester

## Scénario 1

```text
Créer étudiant
→ succès
```

## Scénario 2

```text
Importer Excel valide
→ tous les étudiants créés
```

## Scénario 3

```text
Importer Excel invalide
→ erreurs détaillées
```

## Scénario 4

```text
Marquer étudiant absent
→ Attendance créé
```

## Scénario 5

```text
Absent
→ SmsLog PENDING
→ SMS envoyé
→ SmsLog SENT
```

## Scénario 6

```text
SMS échoué
→ SmsLog FAILED
→ retry
→ SENT
```

## Scénario 7

```text
Même absence
→ deuxième appel
→ aucun SMS doublon
```

---

# 56. Test de permissions

Tester :

```text
ADMIN
TEACHER
Utilisateur non authentifié
```

Exemple :

```text
Teacher
→ accès à ses fonctionnalités

Teacher
→ accès refusé aux opérations ADMIN
```

---

# 57. Health Check

Créer :

```text
GET /health
```

Réponse :

```json
{
  "status": "ok",
  "timestamp": "2026-09-14T..."
}
```

Créer éventuellement :

```text
GET /health/database
```

pour vérifier la connexion PostgreSQL.

---

# 58. Graceful shutdown

Lors de l'arrêt du serveur :

```text
SIGTERM
SIGINT
```

fermer proprement :

```text
HTTP server
Prisma
autres connexions
```

---

# 59. Gestion du mode développement

Créer deux providers SMS :

```text
MockSmsProvider
ProductionSmsProvider
```

Développement :

```env
SMS_PROVIDER=mock
```

Production :

```env
SMS_PROVIDER=production
```

Le MockSmsProvider ne doit jamais être utilisé automatiquement en production.

---

# 60. Seed de développement

Créer un compte :

```text
admin@example.com
```

et :

```text
teacher@example.com
```

Utiliser des mots de passe de développement documentés uniquement dans le README.

Ne jamais utiliser ces identifiants en production.

---

# 61. Performance

Prévoir :

- indexes PostgreSQL ;
- pagination ;
- requêtes Prisma optimisées ;
- `select` pour éviter de récupérer des données inutiles ;
- transactions ;
- limitation des résultats ;
- cache éventuel pour les statistiques.

Ne pas utiliser :

```text
SELECT *
```

conceptuellement partout si seules quelques colonnes sont nécessaires.

---

# 62. Architecture de production

Architecture cible :

```text
                   INTERNET
                       |
                       v
                 React Frontend
                       |
                     HTTPS
                       |
                       v
              Node.js + Express
                       |
              +--------+--------+
              |                 |
              v                 v
         PostgreSQL          SMS API
              |
              v
           Prisma
```

---

# 63. Déploiement

Préparer le backend pour :

```text
Render
Railway
ou autre plateforme Node.js
```

PostgreSQL :

```text
Neon
Supabase
ou PostgreSQL managé
```

Variables d'environnement configurables depuis la plateforme.

---

# 64. Docker

Créer éventuellement :

```text
Dockerfile
.dockerignore
docker-compose.yml
```

Le `docker-compose.yml` de développement peut contenir :

```text
backend
postgres
```

Le service SMS externe ne doit pas être simulé comme une vraie API externe.

---

# 65. README

Créer un README complet :

```text
Présentation
Architecture
Stack
Installation
Configuration
Base de données
Prisma
Migration
Seed
API
Swagger
Tests
Mode Mock SMS
Configuration fournisseur SMS
Déploiement
Sécurité
```

Commandes :

```bash
npm install
npm run dev
npm run build
npm run start
npm run test
npx prisma migrate dev
npx prisma generate
npx prisma db seed
```

---

# 66. `.gitignore`

Inclure :

```text
node_modules
.env
.env.local
dist
coverage
logs
```

Créer :

```text
.env.example
```

Ne jamais commit les secrets.

---

# 67. Règles strictes

Ne fais pas :

```text
❌ logique métier dans les routes
❌ logique métier dans les controllers
❌ SQL dispersé dans les controllers
❌ clés API dans le code
❌ mots de passe en clair
❌ données sensibles dans les logs
❌ SMS directement depuis le controller
❌ double envoi de SMS
❌ absence sans validation
❌ données non validées
❌ erreurs techniques retournées au client
```

Faire :

```text
✓ TypeScript strict
✓ Prisma
✓ Repository Pattern
✓ Services
✓ Controllers légers
✓ Zod
✓ JWT
✓ bcrypt
✓ Middleware
✓ Transactions
✓ Logging
✓ Rate limiting
✓ API REST
✓ Swagger
✓ Tests
✓ Gestion robuste des erreurs
```

---

# 68. Ordre de développement obligatoire

Développer dans cet ordre :

```text
1. Initialisation Node + TypeScript
2. Express
3. Configuration
4. PostgreSQL
5. Prisma
6. Modèles
7. Migrations
8. Seed
9. Authentification
10. Middleware
11. Classes
12. Étudiants
13. Import Excel
14. Cours
15. Présences
16. Notifications
17. SMS
18. Historique
19. Dashboard
20. Tests
21. Swagger
22. Sécurité
23. Optimisation
24. Docker
25. Déploiement
```

---

# 69. Méthode de travail

Pour chaque fonctionnalité :

```text
1. Définir le modèle
2. Créer/adapter Prisma
3. Créer migration
4. Créer repository
5. Créer service
6. Créer validation Zod
7. Créer controller
8. Créer route
9. Ajouter middleware
10. Tester
11. Documenter
```

Ne passe pas à l'étape suivante si la fonctionnalité précédente ne fonctionne pas.

---

# 70. Critères d'acceptation finaux

Le backend est considéré comme terminé uniquement lorsque ce scénario fonctionne :

```text
LOGIN
  ↓
Créer une classe
  ↓
Importer Excel
  ↓
Créer les étudiants
  ↓
Créer un cours
  ↓
Enregistrer les présences
  ↓
Identifier les absents
  ↓
Créer les notifications
  ↓
Envoyer les SMS
  ↓
Enregistrer le résultat
  ↓
Consulter l'historique
  ↓
Afficher les statistiques
```

Le backend doit également gérer correctement :

```text
API indisponible
Base de données indisponible
SMS échoué
Numéro invalide
Excel invalide
Utilisateur non autorisé
JWT expiré
Doublon
Double envoi
Erreur de validation
```

---

# 71. Résultat attendu

À la fin du développement, fournir un backend entièrement fonctionnel :

```text
Node.js
+
TypeScript
+
Express
+
PostgreSQL
+
Prisma
+
JWT
+
bcrypt
+
Zod
+
REST API
+
Excel Import
+
Attendance
+
SMS
+
Notifications
+
Dashboard API
+
Swagger
+
Tests
+
Security
```

Le backend doit être **indépendant du frontend**.

Le frontend React doit pouvoir consommer l'API simplement avec :

```text
GET
POST
PUT
DELETE
```

Toutes les réponses doivent être cohérentes, documentées et prévisibles.

Le système doit être conçu de manière à pouvoir remplacer le fournisseur SMS sans modifier la logique de gestion des présences.

L'objectif n'est pas seulement de produire une API qui fonctionne localement, mais une base backend suffisamment propre pour évoluer vers une véritable application SaaS de gestion scolaire.