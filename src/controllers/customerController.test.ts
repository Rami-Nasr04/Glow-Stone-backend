import type { APIGatewayProxyEventV2 } from "aws-lambda"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ForbiddenError } from "../lib/errors"
import { getMe, NO_CUSTOMER_ROW } from "../services/customerService"
import { me } from "./customerController"

vi.mock("../services/customerService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/customerService")>()),
  getMe: vi.fn(),
}))

const POOL = "eu-central-1_ShopPool1"
const CLIENT = "shopclient456"
const SUB = "1b5c2a4e-8f0d-4c3b-9a71-2e6d5f8a9b10"
const claims = { sub: SUB, iss: `https://cognito-idp.eu-central-1.amazonaws.com/${POOL}`, token_use: "access", client_id: CLIENT }
const event = (c?: Record<string, unknown>) =>
  ({ requestContext: c ? { authorizer: { jwt: { claims: c } } } : {} }) as unknown as APIGatewayProxyEventV2
const body = (res: { body?: string }) => JSON.parse(res.body ?? "")

beforeEach(() => {
  vi.mocked(getMe).mockReset()
  vi.stubEnv("AWS_REGION", "eu-central-1")
  vi.stubEnv("CUSTOMER_USER_POOL_ID", POOL)
  vi.stubEnv("CUSTOMER_APP_CLIENT_ID", CLIENT)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("GET /me", () => {
  it("answers the customer's details for their own sub", async () => {
    vi.mocked(getMe).mockResolvedValue({ email: "sara@example.com", name: "Sara Khoury", phone: "+96171234567" })
    const res = await me(event(claims))
    expect(res.statusCode).toBe(200)
    expect(body(res).data).toEqual({ email: "sara@example.com", name: "Sara Khoury", phone: "+96171234567" })
    expect(getMe).toHaveBeenCalledWith(SUB)
  })

  it("answers 401 without a customer token", async () => {
    const res = await me(event())
    expect(res.statusCode).toBe(401)
    expect(getMe).not.toHaveBeenCalled()
  })

  it("answers 403 FORBIDDEN with the message when the row is missing", async () => {
    vi.mocked(getMe).mockRejectedValue(new ForbiddenError(NO_CUSTOMER_ROW))
    const res = await me(event(claims))
    expect(res.statusCode).toBe(403)
    expect(body(res).error).toEqual({ code: "FORBIDDEN", message: NO_CUSTOMER_ROW })
  })
})
