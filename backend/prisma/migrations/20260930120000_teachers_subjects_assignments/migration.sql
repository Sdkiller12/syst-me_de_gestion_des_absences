-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "assignmentId" TEXT,
ADD COLUMN     "subjectId" TEXT;

-- AlterTable
ALTER TABLE "RevokedToken" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'TOKEN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "username" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "employeeNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeachingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentImport" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "validRows" INTEGER NOT NULL,
    "invalidRows" INTEGER NOT NULL,
    "duplicates" INTEGER NOT NULL,
    "insertedRows" INTEGER NOT NULL,
    "updatedRows" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "reportData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "StudentImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_userId_key" ON "Teacher"("userId");

-- CreateIndex
CREATE INDEX "Teacher_schoolId_idx" ON "Teacher"("schoolId");

-- CreateIndex
CREATE INDEX "Teacher_lastName_firstName_idx" ON "Teacher"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_schoolId_employeeNumber_key" ON "Teacher"("schoolId", "employeeNumber");

-- CreateIndex
CREATE INDEX "Subject_schoolId_idx" ON "Subject"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_schoolId_name_key" ON "Subject"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_schoolId_code_key" ON "Subject"("schoolId", "code");

-- CreateIndex
CREATE INDEX "TeachingAssignment_schoolId_idx" ON "TeachingAssignment"("schoolId");

-- CreateIndex
CREATE INDEX "TeachingAssignment_teacherId_idx" ON "TeachingAssignment"("teacherId");

-- CreateIndex
CREATE INDEX "TeachingAssignment_classId_idx" ON "TeachingAssignment"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingAssignment_teacherId_subjectId_classId_academicYear_key" ON "TeachingAssignment"("teacherId", "subjectId", "classId", "academicYear");

-- CreateIndex
CREATE INDEX "StudentImport_schoolId_idx" ON "StudentImport"("schoolId");

-- CreateIndex
CREATE INDEX "StudentImport_createdAt_idx" ON "StudentImport"("createdAt");

-- CreateIndex
CREATE INDEX "Course_assignmentId_idx" ON "Course"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TeachingAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentImport" ADD CONSTRAINT "StudentImport_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Reprise des données existantes ─────────────────────────────────────────
-- 1. Chaque compte TEACHER existant reçoit sa fiche enseignant
INSERT INTO "Teacher" ("id", "schoolId", "userId", "firstName", "lastName", "phone", "email", "isActive", "createdAt", "updatedAt")
SELECT 'tch_' || u."id", u."schoolId", u."id", u."firstName", u."lastName", u."phone", u."email", u."isActive", u."createdAt", NOW()
FROM "User" u
WHERE u."role" = 'TEACHER' AND u."schoolId" IS NOT NULL;

-- 2. Les matières déjà saisies dans les cours de ces enseignants deviennent des matières réelles
INSERT INTO "Subject" ("id", "schoolId", "name", "createdAt", "updatedAt")
SELECT DISTINCT ON (c."schoolId", lower(trim(c."subject")))
  'sub_' || md5(c."schoolId" || lower(trim(c."subject"))), c."schoolId", trim(c."subject"), NOW(), NOW()
FROM "Course" c
JOIN "Teacher" t ON t."userId" = c."teacherId"
ON CONFLICT DO NOTHING;

-- 3. Les couples enseignant / matière / classe déjà pratiqués deviennent des affectations
INSERT INTO "TeachingAssignment" ("id", "schoolId", "teacherId", "subjectId", "classId", "academicYear", "createdAt", "updatedAt")
SELECT DISTINCT ON (t."id", s."id", c."classId")
  'ta_' || md5(t."id" || s."id" || c."classId"), c."schoolId", t."id", s."id", c."classId", cl."academicYear", NOW(), NOW()
FROM "Course" c
JOIN "Teacher" t ON t."userId" = c."teacherId"
JOIN "Subject" s ON s."schoolId" = c."schoolId" AND lower(s."name") = lower(trim(c."subject"))
JOIN "Class" cl ON cl."id" = c."classId"
ON CONFLICT DO NOTHING;

-- 4. Rattachement des cours existants à leur affectation
UPDATE "Course" c
SET "assignmentId" = ta."id", "subjectId" = ta."subjectId"
FROM "TeachingAssignment" ta
JOIN "Subject" s ON s."id" = ta."subjectId"
JOIN "Teacher" t ON t."id" = ta."teacherId"
WHERE t."userId" = c."teacherId" AND ta."classId" = c."classId" AND lower(s."name") = lower(trim(c."subject"));
