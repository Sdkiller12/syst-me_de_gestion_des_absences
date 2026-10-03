# Backend — Gestion des présences scolaire (SaaS multi-écoles, production)

API REST (Node.js + TypeScript + Express + Prisma + PostgreSQL), source de vérité pour le frontend React. **Zéro donnée simulée en production.**

## Stack
Express 5, Prisma 6, JWT (+ refresh), bcryptjs, Zod, Helmet, CORS, express-rate-limit, Pino, Swagger, Vitest + Supertest, SheetJS.

## Architecture
```
HTTP → Route → Middleware (auth/authorize/requireSchool/validate/rate-limit)
  → Controller (léger + audit) → Service (métier, scopé schoolId)
  → Repository (Prisma) → PostgreSQL
AttendanceService → SmsLog PENDING (transaction) → smsQueue (async)
  → SmsService → SmsProvider (mock/production, config par école) → SMS API
```

## Installation
```bash
npm install
cp .env.example .env   # renseigner DATABASE_URL et JWT_SECRET (>= 32 caractères)
npx prisma migrate dev
npx prisma generate
npm run dev
```

Le premier compte se crée depuis l'application : page « Créer votre espace école » (`/register-school`).

## Scripts
```bash
npm run dev      # tsx watch src/server.ts
npm run build    # tsc
npm run start    # node dist/server.js
npm run test     # vitest run (tests unitaires, sans base)
npm run test:integration  # workflow complet sur une VRAIE base PostgreSQL (voir ci-dessous)
```

Tests d'intégration : ils vident la base visée, donc ils refusent de tourner si le nom de la base
ne se termine pas par `_test`.
```bash
createdb attendance_sms_test   # ou : docker exec <conteneur> psql -U attendance -c "CREATE DATABASE attendance_sms_test"
DATABASE_URL=postgresql://attendance:attendance@localhost:5433/attendance_sms_test npx prisma migrate deploy
DATABASE_URL=postgresql://attendance:attendance@localhost:5433/attendance_sms_test npm run test:integration
```

## Configuration (.env)
`NODE_ENV, PORT, DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, JWT_EXPIRES_IN (défaut 15m), FRONTEND_URL, SMS_PROVIDER (mock|production), SMS_API_URL, SMS_API_KEY, SMS_SENDER, SMS_SENDER_ID, REDIS_URL (optionnel, BullMQ), LOG_LEVEL`. Démarrage refusé si variable critique manquante. Timezone : `TZ=Africa/Abidjan`.

## API (préfixe /api) — erreurs `{success:false, error:{code,message}}`
- Auth : `POST /api/auth/register-school` (onboarding), `POST /api/auth/login` (`identifier` = email ou identifiant), `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`. Session en cookies HttpOnly ; tant que `mustChangePassword` est vrai, seules `/auth/me`, `/auth/change-password` et `/auth/logout` répondent.
- École : `GET /api/schools/me`, `PATCH /api/schools/me`
- Enseignants (SCHOOL_ADMIN) : `GET|POST /api/teachers`, `GET /api/teachers/stats`, `GET|PATCH|DELETE /api/teachers/:id`
  - Import : `POST /api/teachers/import/preview` (multipart Excel/PDF/PDF scanné → OCR), `POST /import/revalidate`, `POST /import/confirm` (revalidation serveur, refus si erreur bloquante)
  - Comptes : `POST /api/teachers/accounts` (lot), `POST /:id/account`, `POST /:id/reset-password`, `PATCH /:id/account-status` — identifiant unique (`jean.kouassi`, `jean.kouassi2`…), mot de passe temporaire renvoyé une seule fois
  - Affectations : `GET|POST /api/teachers/:id/assignments`, `DELETE /:id/assignments/:assignmentId`, vue école `GET /api/assignments`
- Matières (SCHOOL_ADMIN) : `GET|POST /api/subjects`, `PATCH|DELETE /api/subjects/:id`
- Espace enseignant (TEACHER uniquement, identité tirée de la session) : `GET /api/teacher/me`, `/dashboard`, `/classes`, `/classes/:classId/students`, `/courses`, `GET /api/teacher/attendance/sheet?courseId|assignmentId`, `POST /api/teacher/attendance`, `GET /api/teacher/attendance` (historique filtrable), `GET /api/teacher/attendance/:courseId`
- Notes — enseignant (ses classes/matières affectées uniquement) : `GET|POST /api/teacher/evaluations`, `GET|PATCH|DELETE /api/teacher/evaluations/:id`, `PUT /api/teacher/evaluations/:id/grades` (`score: null` efface une note), `GET /api/teacher/grades` (historique), `POST /api/teacher/grades` (nouvelle évaluation ou `evaluationId` + notes, atomique), `PUT /api/teacher/grades/:id`
- Notes — administration (**lecture seule**, toute écriture → `405 READ_ONLY`) : `GET /api/admin/grades` (filtres `classId, subjectId, teacherId, studentId, type, from, to`), `/stats`, `/evaluations`, `/evaluations/:id`, `/students/:studentId` (relevé)
- Emploi du temps — administration : `GET /api/admin/timetable?classId=|teacherId=`, `POST /api/admin/timetable`, `PUT|PATCH|DELETE /api/admin/timetable/:id` ; enseignant (lecture) : `GET /api/teacher/timetable`
- Espace étudiant (STUDENT uniquement, élève tiré de la session) : `GET /api/student/me`, `/grades` (filtres `subjectId, type, from, to`, moyennes calculées), `/timetable`, `/classes`, `/classes/:classId/timetable`
- Comptes élèves (SCHOOL_ADMIN) : `POST /api/students/accounts` (`classId` ou `studentIds`), `POST /api/students/:id/account`, `POST /api/students/:id/reset-password` — même principe que les enseignants (identifiant `prenom.nom`, mot de passe temporaire à changer)
- Public (sans compte, aucune donnée d'élève) : `GET /api/public/schools/:schoolId` (classes), `GET /api/public/schools/:schoolId/classes/:classId/timetable`
- Classes : CRUD + `PATCH /:id`, champs `level/section`, pagination/recherche
- Étudiants : CRUD + `PATCH /:id`, champs `studentNumber/parentName/parentPhone/email`, `POST /api/students/import?classId=` (multipart, rapport `{analyzed,imported,duplicates,invalid,errors}`)
- Cours : CRUD + `PATCH /:id`, champ `room` ; `assignmentId` pour planifier le cours d'un enseignant
- Présences : `GET /api/attendance`, `GET /api/attendance/course/:courseId`, `POST /api/attendance`, `PATCH /api/attendance/:id`, alias `GET /api/history/attendance`
- Notifications/SMS : `GET /api/notifications`, `GET /api/sms/logs` (alias), `GET /:id`, `POST /:id/retry`
- Dashboard : `GET /api/dashboard` (= stats), `GET /api/dashboard/stats`, `/attendance-chart`, `/recent-absences`, `/recent-notifications`
- Admin : `GET /api/audit-logs`, `GET /api/sms-config`, `PUT /api/sms-config`
- Docs : `GET /api/docs` (Swagger). Santé : `GET /health`, `GET /health/database`, `GET /api/health` (db + redis).

## Règles métier
- **Isolation SaaS** : tout est filtré par `schoolId` côté backend (jamais seulement frontend). Rôles : `SUPER_ADMIN` (plateforme) > `SCHOOL_ADMIN` > `TEACHER`, et `STUDENT` (espace élève, consultation).
- **Enseignants** : fiche `Teacher` (+ compte `User` optionnel) ; les droits d'un enseignant viennent exclusivement de ses `TeachingAssignment` (enseignant + matière + classe + année). Les routes d'administration (classes, étudiants, cours, présences, notifications, dashboard) sont réservées à `SCHOOL_ADMIN` ; l'enseignant passe par `/api/teacher/*` (chaîne `authenticate → requireRole(TEACHER) → requireTeacherProfile → requireTeacherAssignment`).
- **Notes** : une `Evaluation` (enseignant + matière + classe, barème `maxScore` défaut 20, `coefficient` > 0) porte des `Grade` (unique `evaluationId + studentId`). Le serveur vérifie l'affectation de l'enseignant, l'appartenance de l'élève (actif) à la classe et `0 ≤ note ≤ barème` ; la base ajoute des `CHECK`. Un enseignant ne voit et ne modifie que ses propres évaluations, et seulement tant qu'il reste affecté. L'administration consulte sans jamais écrire. Moyennes : notes ramenées sur 20, pondérées par coefficient ; moyenne générale = moyenne des moyennes de matière.
- **Emploi du temps** : un `Timetable` par classe, des `TimetableEntry` hebdomadaires (jour 1–7, `HH:mm`, salle facultative). Le créneau exige que l'enseignant soit affecté à la matière dans la classe. Conflits refusés (`409 TIMETABLE_CONFLICT`) : même classe, même enseignant ou même salle sur un horaire qui se chevauche (créneaux consécutifs autorisés), sous verrou transactionnel par école.
- **Espace étudiant** : rôle `STUDENT`, compte lié à la fiche `Student.userId` ; un élève ne lit que ses propres notes (aucun identifiant d'élève accepté depuis la requête). Supprimer la fiche supprime le compte. L'emploi du temps est aussi consultable sans compte via le lien public de l'école (`/schools/:schoolId/timetable` côté frontend), qui n'expose que l'initiale du prénom des enseignants.
- Appel enseignant : pour une séance non planifiée, le cours est créé côté serveur à la date/heure d'`Africa/Abidjan` ; toute la classe doit être renseignée.
- Téléphones CI normalisés E.164 `+225…`, SMS envoyés au `parentPhone` si renseigné sinon `phone`.
- Présences : heure serveur (`absenceTime`), transaction, `SmsLog PENDING` créés dans la transaction puis **envoyés en arrière-plan** (file inline ; BullMQ/Redis si `REDIS_URL`).
- SMS : idempotence (`SmsLog.attendanceId` unique), retry FAILED uniquement, config par école (`SmsConfig`, clés jamais exposées), en production le fournisseur `mock` n'envoie rien et marque le SMS `FAILED` (« Aucun fournisseur SMS configuré ») au lieu de le faire passer pour envoyé ; relance automatique de la file toutes les 2 minutes.
- Audit : `AuditLog` sur login/logout, CRUD classes/étudiants/cours, présences, imports, retry SMS.
- Import Excel : transaction, anti-doublons (fichier + classe + matricule), vérification classe cible.

## Sécurité
Helmet, CORS restreint, rate limiting, JWT court + refresh 30j, bcrypt, Zod, `passwordHash`/`apiKey` jamais exposés, pas de stack trace en prod, logs sans secrets.

## Backups PostgreSQL
```bash
pg_dump "postgresql://..." > backup-$(date +%F).sql
psql "postgresql://..." < backup.sql
```
Fréquence recommandée : quotidienne en production, stockage chiffré externe, test de restauration mensuel.

## Docker
```bash
docker compose up --build   # backend + postgres + redis
```
Prod : `Dockerfile` (`migrate deploy`). Ne jamais utiliser `SMS_PROVIDER=mock` en production réelle.
