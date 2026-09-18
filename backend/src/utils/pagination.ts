import { PAGINATION_DEFAULTS } from "../constants/index.js";

export function parsePagination(query: Record<string, unknown>) {
  let page = Number(query.page ?? PAGINATION_DEFAULTS.page);
  let limit = Number(query.limit ?? PAGINATION_DEFAULTS.limit);
  if (!Number.isFinite(page) || page < 1) page = PAGINATION_DEFAULTS.page;
  if (!Number.isFinite(limit) || limit < 1) limit = PAGINATION_DEFAULTS.limit;
  if (limit > PAGINATION_DEFAULTS.maxLimit) limit = PAGINATION_DEFAULTS.maxLimit;
  const skip = (page - 1) * limit;
  return { page, limit, skip, take: limit };
}

export function paginationMeta(total: number, page: number, limit: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
