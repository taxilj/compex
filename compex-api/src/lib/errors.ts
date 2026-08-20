export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const Errors = {
  unauthorized: () => new AppError("UNAUTHORIZED", "Authentication required", 401),
  forbidden: () => new AppError("FORBIDDEN", "Insufficient permissions", 403),
  // Return 404 for cross-tenant access — never leak resource existence
  notFound: (resource = "Resource") =>
    new AppError("NOT_FOUND", `${resource} not found`, 404),
  conflict: (msg: string) => new AppError("CONFLICT", msg, 409),
  validation: (msg: string) => new AppError("VALIDATION_ERROR", msg, 400),
  rateLimited: () =>
    new AppError("RATE_LIMITED", "Too many requests, please try again later", 429),
  unprocessable: (msg: string) => new AppError("UNPROCESSABLE", msg, 422),
  internal: (msg = "Internal server error") => new AppError("INTERNAL_ERROR", msg, 500),
};