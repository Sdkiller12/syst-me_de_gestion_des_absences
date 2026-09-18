import { prisma } from "../config/database.js";
import type { Prisma } from "@prisma/client";

export const classRepository = {
  findMany: (args: Parameters<typeof prisma.class.findMany>[0]) => prisma.class.findMany(args),
  findById: (id: string) => prisma.class.findUnique({ where: { id } }),
  create: (data: Prisma.ClassUncheckedCreateInput) => prisma.class.create({ data }),
  update: (id: string, data: Prisma.ClassUpdateInput) => prisma.class.update({ where: { id }, data }),
  delete: (id: string) => prisma.class.delete({ where: { id } }),
  count: (where?: Prisma.ClassWhereInput) => prisma.class.count({ where }),
};
