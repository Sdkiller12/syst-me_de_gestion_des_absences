import { prisma } from "../config/database.js";
import { notFound } from "../utils/errors.js";

export const schoolService = {
  async me(schoolId: string | null, userRole: string, querySchoolId?: string) {
    const id = userRole === "SUPER_ADMIN" ? (querySchoolId ?? schoolId) : schoolId;
    if (!id) throw notFound("École introuvable", "NOT_FOUND");
    const school = await prisma.school.findUnique({ where: { id } });
    if (!school) throw notFound("École introuvable", "NOT_FOUND");
    return school;
  },

  async update(schoolId: string, payload: { name?: string; email?: string | null; phone?: string | null; address?: string | null; city?: string | null; country?: string | null; logo?: string | null }) {
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw notFound("École introuvable", "NOT_FOUND");
    return prisma.school.update({ where: { id: schoolId }, data: payload });
  },

  async stats(schoolId: string) {
    const [users, classes, students, courses] = await Promise.all([
      prisma.user.count({ where: { schoolId } }),
      prisma.class.count({ where: { schoolId } }),
      prisma.student.count({ where: { schoolId } }),
      prisma.course.count({ where: { schoolId } }),
    ]);
    return { users, classes, students, courses };
  },
};
