import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toErrorPayload(error: unknown) {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        details: error.details ?? {}
      }
    };
  }

  if (error instanceof ZodError) {
    return {
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        statusCode: 422,
        details: {
          issues: error.issues
        }
      }
    };
  }

  const message = error instanceof Error ? error.message : "Unexpected error";

  return {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message,
      statusCode: 500,
      details: {}
    }
  };
}

export function asAppError(error: unknown) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new AppError("VALIDATION_ERROR", 422, "Request validation failed", {
      issues: error.issues
    });
  }

  if (error instanceof Error) {
    return new AppError("INTERNAL_SERVER_ERROR", 500, error.message);
  }

  return new AppError("INTERNAL_SERVER_ERROR", 500, "Unexpected error");
}

export function assertFound<T>(value: T | null | undefined, code: string, message: string): asserts value is T {
  if (value == null) {
    throw new AppError(code, 404, message);
  }
}

export function forbidden(message: string, details?: Record<string, unknown>) {
  return new AppError("AUTH_FORBIDDEN", 403, message, details);
}

export function unauthorized(code: string, message: string) {
  return new AppError(code, 401, message);
}

export function notFound(code: string, message: string) {
  return new AppError(code, 404, message);
}

export function conflict(code: string, message: string) {
  return new AppError(code, 409, message);
}

export function badRequest(code: string, message: string, details?: Record<string, unknown>) {
  return new AppError(code, 400, message, details);
}
