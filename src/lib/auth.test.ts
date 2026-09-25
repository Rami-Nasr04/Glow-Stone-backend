import type { APIGatewayProxyEventV2 } from "aws-lambda"
import { describe, expect, it } from "vitest"
import { getAuth, parseGroups, requireRole } from "./auth"
import { ForbiddenError, UnauthorizedError } from "./errors"

const eventWithClaims = (claims: Record<string, unknown>): APIGatewayProxyEventV2 =>
  ({ requestContext: { authorizer: { jwt: { claims } } } }) as unknown as APIGatewayProxyEventV2

describe("parseGroups()", () => {
  it("handles real arrays", () => {
    expect(parseGroups(["admin"])).toEqual(["admin"])
  })

  it("handles the bracketed string form from the JWT authorizer", () => {
    expect(parseGroups("[admin customer]")).toEqual(["admin", "customer"])
  })

  it("handles comma-separated strings", () => {
    expect(parseGroups("admin,customer")).toEqual(["admin", "customer"])
  })

  it("returns [] for empty or missing values", () => {
    expect(parseGroups("[]")).toEqual([])
    expect(parseGroups(undefined)).toEqual([])
  })
})

describe("getAuth()", () => {
  it("returns null when there are no claims", () => {
    expect(getAuth({ requestContext: {} } as unknown as APIGatewayProxyEventV2)).toBeNull()
  })

  it("extracts sub, email, and groups", () => {
    const auth = getAuth(eventWithClaims({ sub: "abc", email: "a@b.com", "cognito:groups": "[admin]" }))
    expect(auth).toEqual({ sub: "abc", email: "a@b.com", groups: ["admin"] })
  })
})

describe("requireRole()", () => {
  it("throws UnauthorizedError when unauthenticated", () => {
    expect(() => requireRole(null, "admin")).toThrow(UnauthorizedError)
  })

  it("throws ForbiddenError when the role is missing", () => {
    expect(() => requireRole({ sub: "a", email: "", groups: ["customer"] }, "admin")).toThrow(ForbiddenError)
  })

  it("passes when the role matches", () => {
    expect(() => requireRole({ sub: "a", email: "", groups: ["admin"] }, "admin")).not.toThrow()
  })
})
