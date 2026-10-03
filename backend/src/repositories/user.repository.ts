import { prisma } from "../config/database.js";

export const userRepository = {
  findByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),
  findByIdentifier: (identifier: string) =>
    prisma.user.findFirst({ where: { OR: [{ email: identifier }, { username: identifier }] } }),
  findById: (id: string) => prisma.user.findUnique({ where: { id } }),
};
