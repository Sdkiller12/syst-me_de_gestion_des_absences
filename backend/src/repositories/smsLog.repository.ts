import { prisma } from "../config/database.js";
import type { Prisma } from "@prisma/client";

export const smsLogRepository = {
  findMany: (args?: Prisma.SmsLogFindManyArgs) => prisma.smsLog.findMany(args ?? {}),
  count: (where?: Prisma.SmsLogWhereInput) => prisma.smsLog.count({ where }),
  findById: (id: string) => prisma.smsLog.findUnique({ where: { id }, include: { student: true, attendance: { include: { course: true } } } }),
  findByAttendanceId: (attendanceId: string) => prisma.smsLog.findUnique({ where: { attendanceId } }),
  findByIds: (ids: string[]) => prisma.smsLog.findMany({ where: { id: { in: ids } } }),
  create: (data: Prisma.SmsLogCreateInput) => prisma.smsLog.create({ data }),
  createMany: (data: Prisma.SmsLogCreateManyInput | Prisma.SmsLogCreateManyInput[]) => prisma.smsLog.createMany({ data }),
  update: (id: string, data: Prisma.SmsLogUpdateInput) => prisma.smsLog.update({ where: { id }, data }),
};
