export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(message = "Ressource introuvable", code = "NOT_FOUND") {
  return new AppError(404, message, code);
}
export function unauthorized(message = "Non authentifié", code = "UNAUTHORIZED") {
  return new AppError(401, message, code);
}
export function forbidden(message = "Accès refusé", code = "FORBIDDEN") {
  return new AppError(403, message, code);
}
export function conflict(message: string, code = "CONFLICT") {
  return new AppError(409, message, code);
}
export function badRequest(message: string, code = "VALIDATION_ERROR") {
  return new AppError(400, message, code);
}
