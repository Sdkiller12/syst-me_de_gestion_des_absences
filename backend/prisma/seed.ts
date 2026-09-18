import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * DEVELOPMENT seed only. Never run in production.
 * Creates a fully-populated demo school so every feature can be tested
 * without manually creating data:
 *   - 1 school, 1 admin, 2 teachers
 *   - 2 classes (6ème A, 5ème B) with 8 students each
 *   - 4 courses (2 per class, past dates)
 *   - Attendance records with mixed statuses
 */
async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refus: ne pas exécuter le seed de développement en production");
  }

  console.log("🌱 Seeding dev data…");
  const passwordHash = await bcrypt.hash("password123", 10);

  // ─── School ────────────────────────────────────────────────────────────────
  const school = await prisma.school.upsert({
    where: { email: "contact@college-exemple.ci" },
    update: {},
    create: {
      name: "Collège Exemple (DEV)",
      email: "contact@college-exemple.ci",
      phone: "+2250700000001",
      city: "Abidjan",
      country: "Côte d'Ivoire",
    },
  });

  // ─── Users ─────────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { schoolId: school.id, role: "SCHOOL_ADMIN" },
    create: {
      schoolId: school.id,
      firstName: "Admin",
      lastName: "ECOLE",
      name: "Admin ECOLE",
      email: "admin@example.com",
      passwordHash,
      role: "SCHOOL_ADMIN",
    },
  });

  const teacher1 = await prisma.user.upsert({
    where: { email: "teacher@example.com" },
    update: { schoolId: school.id, role: "TEACHER" },
    create: {
      schoolId: school.id,
      firstName: "Awa",
      lastName: "ENSEIGNANT",
      name: "Awa ENSEIGNANT",
      email: "teacher@example.com",
      passwordHash,
      role: "TEACHER",
    },
  });

  const teacher2 = await prisma.user.upsert({
    where: { email: "teacher2@example.com" },
    update: { schoolId: school.id, role: "TEACHER" },
    create: {
      schoolId: school.id,
      firstName: "Kouame",
      lastName: "PROF",
      name: "Kouame PROF",
      email: "teacher2@example.com",
      passwordHash,
      role: "TEACHER",
    },
  });

  // ─── Classes ───────────────────────────────────────────────────────────────
  const classA = await prisma.class.upsert({
    where: { schoolId_name_academicYear: { schoolId: school.id, name: "6ème A", academicYear: "2025-2026" } },
    update: {},
    create: { schoolId: school.id, name: "6ème A", academicYear: "2025-2026", level: "6ème", section: "A" },
  });

  const classB = await prisma.class.upsert({
    where: { schoolId_name_academicYear: { schoolId: school.id, name: "5ème B", academicYear: "2025-2026" } },
    update: {},
    create: { schoolId: school.id, name: "5ème B", academicYear: "2025-2026", level: "5ème", section: "B" },
  });

  // ─── Students ──────────────────────────────────────────────────────────────
  const studentsClassA = [
    { firstName: "Aminata",  lastName: "COULIBALY", studentNumber: "6A-001", parentPhone: "+2250701000001" },
    { firstName: "Koffi",    lastName: "ASSOUMOU",  studentNumber: "6A-002", parentPhone: "+2250701000002" },
    { firstName: "Fatou",    lastName: "DIALLO",    studentNumber: "6A-003", parentPhone: "+2250701000003" },
    { firstName: "Ibrahim",  lastName: "TRAORE",    studentNumber: "6A-004", parentPhone: "+2250701000004" },
    { firstName: "Mariam",   lastName: "OUATTARA",  studentNumber: "6A-005", parentPhone: "+2250701000005" },
    { firstName: "Seydou",   lastName: "KONE",      studentNumber: "6A-006", parentPhone: "+2250701000006" },
    { firstName: "Adja",     lastName: "SYLLA",     studentNumber: "6A-007", parentPhone: "+2250701000007" },
    { firstName: "Youssouf", lastName: "BAMBA",     studentNumber: "6A-008", parentPhone: "+2250701000008" },
  ];

  const studentsClassB = [
    { firstName: "Clarisse", lastName: "GBAGBO",    studentNumber: "5B-001", parentPhone: "+2250701000011" },
    { firstName: "Daouda",   lastName: "SANGARE",   studentNumber: "5B-002", parentPhone: "+2250701000012" },
    { firstName: "Estelle",  lastName: "AKPA",      studentNumber: "5B-003", parentPhone: "+2250701000013" },
    { firstName: "Franck",   lastName: "YOBOUE",    studentNumber: "5B-004", parentPhone: "+2250701000014" },
    { firstName: "Grace",    lastName: "KOUASSI",   studentNumber: "5B-005", parentPhone: "+2250701000015" },
    { firstName: "Henri",    lastName: "DEMBELE",   studentNumber: "5B-006", parentPhone: "+2250701000016" },
    { firstName: "Ines",     lastName: "FOFANA",    studentNumber: "5B-007", parentPhone: "+2250701000017" },
    { firstName: "Joel",     lastName: "GONDO",     studentNumber: "5B-008", parentPhone: "+2250701000018" },
  ];

  const createdStudentsA: { id: string }[] = [];
  for (const s of studentsClassA) {
    const st = await prisma.student.upsert({
      where: { schoolId_studentNumber: { schoolId: school.id, studentNumber: s.studentNumber } },
      update: {},
      create: {
        schoolId: school.id,
        classId: classA.id,
        firstName: s.firstName,
        lastName: s.lastName,
        studentNumber: s.studentNumber,
        phone: "",
        parentName: `Parent de ${s.firstName}`,
        parentPhone: s.parentPhone,
      },
    });
    createdStudentsA.push({ id: st.id });
  }

  const createdStudentsB: { id: string }[] = [];
  for (const s of studentsClassB) {
    const st = await prisma.student.upsert({
      where: { schoolId_studentNumber: { schoolId: school.id, studentNumber: s.studentNumber } },
      update: {},
      create: {
        schoolId: school.id,
        classId: classB.id,
        firstName: s.firstName,
        lastName: s.lastName,
        studentNumber: s.studentNumber,
        phone: "",
        parentName: `Parent de ${s.firstName}`,
        parentPhone: s.parentPhone,
      },
    });
    createdStudentsB.push({ id: st.id });
  }

  // ─── Courses (use past dates for realistic history) ────────────────────────
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  twoDaysAgo.setHours(0, 0, 0, 0);

  async function upsertCourse(data: {
    schoolId: string;
    classId: string;
    teacherId: string;
    subject: string;
    date: Date;
    startTime: string;
    endTime: string;
  }) {
    // Courses have no unique constraint — check by schoolId+classId+subject+date to avoid duplicates
    const existing = await prisma.course.findFirst({
      where: {
        schoolId: data.schoolId,
        classId: data.classId,
        subject: data.subject,
        date: data.date,
        startTime: data.startTime,
      },
    });
    if (existing) return existing;
    return prisma.course.create({ data });
  }

  const courseA1 = await upsertCourse({
    schoolId: school.id, classId: classA.id, teacherId: teacher1.id,
    subject: "Mathematiques", date: yesterday, startTime: "08:00", endTime: "09:00",
  });
  const courseA2 = await upsertCourse({
    schoolId: school.id, classId: classA.id, teacherId: teacher2.id,
    subject: "Francais", date: twoDaysAgo, startTime: "10:00", endTime: "11:00",
  });
  const courseB1 = await upsertCourse({
    schoolId: school.id, classId: classB.id, teacherId: teacher1.id,
    subject: "Sciences", date: yesterday, startTime: "09:00", endTime: "10:00",
  });
  const courseB2 = await upsertCourse({
    schoolId: school.id, classId: classB.id, teacherId: teacher2.id,
    subject: "Histoire-Geographie", date: twoDaysAgo, startTime: "11:00", endTime: "12:00",
  });

  // ─── Attendance records ───────────────────────────────────────────────────
  // Class A / courseA1: first 2 absent, rest present
  const attendanceA1: Array<{ studentId: string; status: "PRESENT" | "ABSENT" | "LATE" | "JUSTIFIED" }> = createdStudentsA.map((s, i) => ({
    studentId: s.id,
    status: i < 2 ? "ABSENT" : "PRESENT",
  }));

  // Class A / courseA2: 1 late, 1 justified, rest present
  const attendanceA2: Array<{ studentId: string; status: "PRESENT" | "ABSENT" | "LATE" | "JUSTIFIED" }> = createdStudentsA.map((s, i) => ({
    studentId: s.id,
    status: i === 0 ? "LATE" : i === 1 ? "JUSTIFIED" : "PRESENT",
  }));

  // Class B / courseB1: first 3 absent
  const attendanceB1: Array<{ studentId: string; status: "PRESENT" | "ABSENT" | "LATE" | "JUSTIFIED" }> = createdStudentsB.map((s, i) => ({
    studentId: s.id,
    status: i < 3 ? "ABSENT" : "PRESENT",
  }));

  // Class B / courseB2: all present
  const attendanceB2: Array<{ studentId: string; status: "PRESENT" | "ABSENT" | "LATE" | "JUSTIFIED" }> = createdStudentsB.map((s) => ({
    studentId: s.id,
    status: "PRESENT",
  }));

  async function seedAttendance(
    courseId: string,
    records: Array<{ studentId: string; status: "PRESENT" | "ABSENT" | "LATE" | "JUSTIFIED" }>,
    recordedById: string,
  ) {
    for (const r of records) {
      await prisma.attendance.upsert({
        where: { courseId_studentId: { courseId, studentId: r.studentId } },
        update: {},
        create: {
          courseId,
          studentId: r.studentId,
          status: r.status,
          recordedBy: recordedById,
          absenceTime: r.status === "ABSENT" ? new Date() : null,
        },
      });
    }
  }

  await seedAttendance(courseA1.id, attendanceA1, teacher1.id);
  await seedAttendance(courseA2.id, attendanceA2, teacher2.id);
  await seedAttendance(courseB1.id, attendanceB1, teacher1.id);
  await seedAttendance(courseB2.id, attendanceB2, teacher2.id);

  console.log(`✅ Seed DEV terminé:`);
  console.log(`   École   : ${school.name}`);
  console.log(`   Admin   : ${admin.email}  (password123)`);
  console.log(`   Teacher1: ${teacher1.email}  (password123)`);
  console.log(`   Teacher2: ${teacher2.email}  (password123)`);
  console.log(`   Classes : 6ème A (${createdStudentsA.length} élèves), 5ème B (${createdStudentsB.length} élèves)`);
  console.log(`   Cours   : 4 cours avec présences enregistrées`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
