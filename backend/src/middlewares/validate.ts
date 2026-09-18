import type { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";

export function validate(target: "body" | "query" | "params", schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const source = (req as unknown as Record<string, unknown>)[target];
    const parsed = schema.safeParse(source);
    if (!parsed.success) return next(parsed.error);
    // Express 5 makes req.query a read-only getter — use Object.defineProperty to override it
    try {
      (req as unknown as Record<string, unknown>)[target] = parsed.data;
    } catch {
      Object.defineProperty(req, target, { value: parsed.data, writable: true, configurable: true });
    }
    return next();
  };
}
