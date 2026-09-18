import { prisma } from "../config/database.js";
import type { Prisma } from "@prisma/client";

export const studentRepository = {
  findMany: (args: Parameters<typeof prisma.student.findMany>[0]) => prisma.student.findMany(args),
  count: (where?: Prisma.StudentWhereInput) => prisma.student.count({ where }),
  findById: (id: string) => prisma.student.findUnique({ where: { id }, include: { class: true } }),
  findByIds: (ids: string[]) => prisma.student.findMany({ where: { id: { in: ids } } }),
  create: (data: Prisma.StudentUncheckedCreateInput) => prisma.student.create({ data }),
  update: (id: string, data: Prisma.StudentUpdateInput) => prisma.student.update({ where: { id }, data }),
  delete: (id: string) => prisma.student.delete({ where: { id } }),
  existsByNameInClass: (schoolId: string, classId: string, firstName: string, lastName: string) =>
    prisma.student.findFirst({
      where: {
        schoolId,
        classId,
        firstName: { equals: firstName, mode: "insensitive" },
        lastName: { equals: lastName, mode: "insensitive" },
      },
    }),
};
