import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { ZodError } from "zod"
import {
  ConflictError,
  ForbiddenError,
  InvalidBodyError,
  NotFoundError,
  OrderRefusedError,
  RequestReusedError,
  UnauthorizedError,
  UpstreamError,
  ValidationError,
} from "../lib/errors"
import type { ApiResponse } from "../types/api"

const JSON_HEADERS = { "Content-Type": "application/json" }

export function ok<T>(data: T, statusCode = 200): APIGatewayProxyStructuredResultV2 {
  const body: ApiResponse<T> = { success: true, data }
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) }
}

export function fail(code: string, message: string, statusCode = 400, productId?: number): APIGatewayProxyStructuredResultV2 {
  const body: ApiResponse<never> = { success: false, error: productId === undefined ? { code, message } : { code, message, productId } }
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) }
}

interface MappedError {
  code: string
  message: string
  status: number
}

const COGNITO_ERROR_MAP: Record<string, MappedError> = {
  UsernameExistsException: { code: "CONFLICT", message: "A user with that email already exists", status: 409 },
  UserNotFoundException: { code: "NOT_FOUND", message: "No account found for that email", status: 404 },
  NotAuthorizedException: { code: "UNAUTHORIZED", message: "Not authorized", status: 401 },
  InvalidPasswordException: { code: "VALIDATION", message: "Password does not meet the requirements", status: 400 },
  CodeMismatchException: { code: "VALIDATION", message: "That code is incorrect", status: 400 },
  ExpiredCodeException: { code: "VALIDATION", message: "That code has expired — request a new one", status: 400 },
  LimitExceededException: { code: "RATE_LIMITED", message: "Too many attempts — try again later", status: 429 },
}

const PG_ERROR_MAP: Record<string, MappedError> = {
  "23514": { code: "VALIDATION", message: "That value isn't allowed", status: 400 },
  "22P02": { code: "VALIDATION", message: "Malformed value (uuid, date, time, or numeric)", status: 400 },
  "22007": { code: "VALIDATION", message: "Invalid date/time format", status: 400 },
  "22008": { code: "VALIDATION", message: "Date/time field out of range", status: 400 },
  "23505": { code: "CONFLICT", message: "A record with that unique value already exists", status: 409 },
  "23503": { code: "CONFLICT", message: "Referenced record is missing or still in use", status: 409 },
  "53300": { code: "BUSY", message: "System is busy — please retry in a moment", status: 503 },
}

// Database rules whose own message is clearer than the generic one for their error code.
const PG_CONSTRAINT_MAP: Record<string, MappedError> = {
  remaining_within_edition: { code: "VALIDATION", message: "remaining can't be more than editionSize", status: 400 },
  products_published_name_unique: { code: "CONFLICT", message: "A published piece already has that name", status: 409 },
  order_items_product_id_fkey: {
    code: "CONFLICT",
    message: "This piece has orders, so it can't be deleted. Keep it as a draft instead.",
    status: 409,
  },
}

function isPgError(err: unknown): err is { code: string; constraint?: string } {
  return typeof err === "object" && err !== null && "code" in err && typeof err.code === "string"
}

/** The single error translator — every controller's catch block returns handleError(err). */
export function handleError(err: unknown): APIGatewayProxyStructuredResultV2 {
  if (err instanceof ZodError) return fail("VALIDATION", err.issues[0]?.message ?? "Invalid input", 400)
  if (err instanceof InvalidBodyError) return fail("VALIDATION", err.message, 400)
  if (err instanceof ValidationError) return fail("VALIDATION", err.message, 400)
  if (err instanceof UnauthorizedError) return fail("UNAUTHORIZED", err.message, 401)
  if (err instanceof ForbiddenError) return fail("FORBIDDEN", err.message, 403)
  if (err instanceof NotFoundError) return fail("NOT_FOUND", err.message, 404)
  if (err instanceof ConflictError) return fail("CONFLICT", err.message, 409)
  if (err instanceof OrderRefusedError) return fail(err.code, err.message, 409, err.productId)
  if (err instanceof RequestReusedError) return fail("REQUEST_REUSED", err.message, 422)
  if (err instanceof UpstreamError) return fail(err.code, err.message, 502)
  if (err instanceof Error && err.name in COGNITO_ERROR_MAP) {
    const m = COGNITO_ERROR_MAP[err.name]
    return fail(m.code, m.message, m.status)
  }
  if (isPgError(err) && err.constraint && err.constraint in PG_CONSTRAINT_MAP) {
    const m = PG_CONSTRAINT_MAP[err.constraint]
    return fail(m.code, m.message, m.status)
  }
  if (isPgError(err) && err.code in PG_ERROR_MAP) {
    const m = PG_ERROR_MAP[err.code]
    return fail(m.code, m.message, m.status)
  }
  console.error("Unhandled error:", err)
  return fail("INTERNAL", "Internal server error", 500)
}
