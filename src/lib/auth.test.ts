import type { APIGatewayProxyEventV2 } from "aws-lambda"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { requireAdmin, requireCustomer } from "./auth"
import { UnauthorizedError } from "./errors"

const POOL = "eu-central-1_TestPool1"
const CLIENT = "testclient123"
const ISSUER = `https://cognito-idp.eu-central-1.amazonaws.com/${POOL}`

const SHOP_POOL = "eu-central-1_ShopPool1"
const SHOP_CLIENT = "shopclient456"
const customerClaims = {
  sub: "1b5c2a4e-0000",
  iss: `https://cognito-idp.eu-central-1.amazonaws.com/${SHOP_POOL}`,
  token_use: "access",
  client_id: SHOP_CLIENT,
}

const adminClaims = { sub: "7334b882-0000", iss: ISSUER, token_use: "access", client_id: CLIENT }

const eventWithClaims = (claims: Record<string, unknown>): APIGatewayProxyEventV2 =>
  ({ requestContext: { authorizer: { jwt: { claims } } } }) as unknown as APIGatewayProxyEventV2

beforeEach(() => {
  vi.stubEnv("AWS_REGION", "eu-central-1")
  vi.stubEnv("ADMIN_USER_POOL_ID", POOL)
  vi.stubEnv("ADMIN_APP_CLIENT_ID", CLIENT)
  vi.stubEnv("CUSTOMER_USER_POOL_ID", SHOP_POOL)
  vi.stubEnv("CUSTOMER_APP_CLIENT_ID", SHOP_CLIENT)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("requireAdmin()", () => {
  it("returns the admin's sub for an access token from the admin pool and the studio client", () => {
    expect(requireAdmin(eventWithClaims(adminClaims))).toEqual({ sub: "7334b882-0000" })
  })

  it("refuses a request with no authorizer claims", () => {
    expect(() => requireAdmin({ requestContext: {} } as unknown as APIGatewayProxyEventV2)).toThrow(UnauthorizedError)
  })

  it.each([
    ["another pool", { iss: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_Customers" }],
    ["another region", { iss: `https://cognito-idp.eu-west-3.amazonaws.com/${POOL}` }],
    ["an ID token", { token_use: "id" }],
    ["another app client", { client_id: "otherclient" }],
    ["no sub", { sub: "" }],
    ["no issuer", { iss: undefined }],
  ])("refuses a token from %s", (_label, override) => {
    expect(() => requireAdmin(eventWithClaims({ ...adminClaims, ...override }))).toThrow(UnauthorizedError)
  })

  it("fails loudly when the admin pool settings are missing", () => {
    vi.stubEnv("ADMIN_USER_POOL_ID", "")
    expect(() => requireAdmin(eventWithClaims(adminClaims))).toThrow("Missing required env var: ADMIN_USER_POOL_ID")
  })
})

describe("requireCustomer()", () => {
  it("returns the customer's sub for an access token from the customer pool and the shop client", () => {
    expect(requireCustomer(eventWithClaims(customerClaims))).toEqual({ sub: "1b5c2a4e-0000" })
  })

  it("refuses an admin's token", () => {
    expect(() => requireCustomer(eventWithClaims(adminClaims))).toThrow(UnauthorizedError)
  })

  it("is refused on admin routes", () => {
    expect(() => requireAdmin(eventWithClaims(customerClaims))).toThrow(UnauthorizedError)
  })

  it.each([
    ["an ID token", { token_use: "id" }],
    ["another app client", { client_id: CLIENT }],
    ["no sub", { sub: "" }],
  ])("refuses %s", (_label, override) => {
    expect(() => requireCustomer(eventWithClaims({ ...customerClaims, ...override }))).toThrow(UnauthorizedError)
  })

  it("fails loudly when the customer pool settings are missing", () => {
    vi.stubEnv("CUSTOMER_APP_CLIENT_ID", "")
    expect(() => requireCustomer(eventWithClaims(customerClaims))).toThrow("Missing required env var: CUSTOMER_APP_CLIENT_ID")
  })
})
