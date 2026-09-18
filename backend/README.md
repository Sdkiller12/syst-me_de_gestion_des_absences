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

Seed **développement uniquement** (refuse de tourner si `NODE_ENV=production`) :
```bash
npm run db:seed   # école démo + admin@example.com / teacher@example.com (password123)
```

## Scripts
```bash
npm run dev      # tsx watch src/server.ts
npm run build    # tsc
npm run start    # node dist/server.js
npm run test     # vitest run
```

## Configuration (.env)
`NODE_ENV, PORT, DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, JWT_EXPIRES_IN (défaut 15m), FRONTEND_URL, SMS_PROVIDER (mock|production), SMS_API_URL, SMS_API_KEY, SMS_SENDER, SMS_SENDER_ID, REDIS_URL (optionnel, BullMQ), LOG_LEVEL`. Démarrage refusé si variable critique manquante. Timezone : `TZ=Africa/Abidjan`.

## API (préfixe /api) — erreurs `{success:false, error:{code,message}}`
- Auth : `POST /api/auth/register-school` (onboarding), `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`
- École : `GET /api/schools/me`, `PATCH /api/schools/me`
- Enseignants : `GET /api/teachers`, `POST /api/teachers`, `PATCH /api/teachers/:id`, `DELETE /api/teachers/:id`
- Classes : CRUD + `PATCH /:id`, champs `level/section`, pagination/recherche
- Étudiants : CRUD + `PATCH /:id`, champs `studentNumber/parentName/parentPhone/email`, `POST /api/students/import?classId=` (multipart, rapport `{analyzed,imported,duplicates,invalid,errors}`)
- Cours : CRUD + `PATCH /:id`, champ `room`, enseignants limités à leurs cours
- Présences : `GET /api/attendance`, `GET /api/attendance/course/:courseId`, `POST /api/attendance`, `PATCH /api/attendance/:id`, alias `GET /api/history/attendance`
- Notifications/SMS : `GET /api/notifications`, `GET /api/sms/logs` (alias), `GET /:id`, `POST /:id/retry`
- Dashboard : `GET /api/dashboard` (= stats), `GET /api/dashboard/stats`, `/attendance-chart`, `/recent-absences`, `/recent-notifications`
- Admin : `GET /api/audit-logs`, `GET /api/sms-config`, `PUT /api/sms-config`
- Docs : `GET /api/docs` (Swagger). Santé : `GET /health`, `GET /health/database`, `GET /api/health` (db + redis).

## Règles métier
- **Isolation SaaS** : tout est filtré par `schoolId` côté backend (jamais seulement frontend). Rôles : `SUPER_ADMIN` (plateforme) > `SCHOOL_ADMIN` > `TEACHER` (cours/historique restreints).
- Téléphones CI normalisés E.164 `+225…`, SMS envoyés au `parentPhone` si renseigné sinon `phone`.
- Présences : heure serveur (`absenceTime`), transaction, `SmsLog PENDING` créés dans la transaction puis **envoyés en arrière-plan** (file inline ; BullMQ/Redis si `REDIS_URL`).
- SMS : idempotence (`SmsLog.attendanceId` unique), retry FAILED uniquement, config par école (`SmsConfig`, clés jamais exposées), mock interdit en production.
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
Prod : `Dockerfile` (`migrate deploy`). Ne jamais exécuter le seed ni `SMS_PROVIDER=mock` en production réelle.
