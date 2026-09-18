import { prisma } from "../config/database.js";
import type { Prisma } from "@prisma/client";

export const courseRepository = {
  findMany: (args: Parameters<typeof prisma.course.findMany>[0]) => prisma.course.findMany(args),
  count: (where?: Prisma.CourseWhereInput) => prisma.course.count({ where }),
  findById: (id: string) => prisma.course.findUnique({ where: { id }, include: { class: true, teacher: true } }),
  create: (data: Prisma.CourseUncheckedCreateInput) => prisma.course.create({ data }),
  update: (id: string, data: Prisma.CourseUpdateInput) => prisma.course.update({ where: { id }, data }),
  delete: (id: string) => prisma.course.delete({ where: { id } }),
};
