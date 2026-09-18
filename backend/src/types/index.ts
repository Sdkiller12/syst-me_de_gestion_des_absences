import type { Request } from "express";

export type Role = "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER";

export interface JwtPayload {
  userId: string;
  schoolId: string | null;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  schoolId: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
