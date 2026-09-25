import type { APIGatewayProxyEventV2 } from "aws-lambda"
import { ForbiddenError, UnauthorizedError } from "./errors"
import type { UserRole } from "../types/api"

export interface AuthContext {
  sub: string
  email: string
  groups: string[]
}

// The HTTP API JWT authorizer exposes `cognito:groups` as a stringified array
// ("[admin customer]"), not a real array. Normalize bracketed, comma- and space-separated forms.
export function parseGroups(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  if (typeof raw === "string") {
    const inner = raw.trim().replace(/^\[/, "").replace(/\]$/, "")
    if (!inner) return []
    return inner.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
  }
  return []
}

export function getAuth(event: APIGatewayProxyEventV2): AuthContext | null {
  const claims = (event.requestContext as { authorizer?: { jwt?: { claims?: Record<string, unknown> } } })
    ?.authorizer?.jwt?.claims
  if (!claims || !claims.sub) return null
  return {
    sub: String(claims.sub),
    email: claims.email ? String(claims.email) : "",
    groups: parseGroups(claims["cognito:groups"]),
  }
}

// Throws (handleError translates). `asserts` narrows auth to non-null for the caller.
export function requireRole(
  auth: AuthContext | null,
  ...allowedRoles: UserRole[]
): asserts auth is AuthContext {
  if (!auth) throw new UnauthorizedError()
  if (!auth.groups.some((g) => allowedRoles.includes(g as UserRole))) throw new ForbiddenError()
}
