import type { APIGatewayProxyEventV2 } from "aws-lambda"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { UpstreamError } from "../lib/errors"
import { publishSite } from "../services/publishService"
import { publish } from "./adminPublishController"

vi.mock("../services/publishService")

const POOL = "eu-central-1_TestPool1"
const CLIENT = "testclient123"
const adminClaims = {
  sub: "7334b882-0000",
  iss: `https://cognito-idp.eu-central-1.amazonaws.com/${POOL}`,
  token_use: "access",
  client_id: CLIENT,
}

const event = (claims: Record<string, unknown> | null = adminClaims): APIGatewayProxyEventV2 =>
  ({ requestContext: claims ? { authorizer: { jwt: { claims } } } : {} }) as unknown as APIGatewayProxyEventV2

const body = (res: { body?: string }) => JSON.parse(res.body ?? "")

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("AWS_REGION", "eu-central-1")
  vi.stubEnv("ADMIN_USER_POOL_ID", POOL)
  vi.stubEnv("ADMIN_APP_CLIENT_ID", CLIENT)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("POST /admin/publish", () => {
  it("starts the rebuild and answers 202 { started: true }", async () => {
    vi.mocked(publishSite).mockResolvedValue()
    const res = await publish(event())
    expect(res.statusCode).toBe(202)
    expect(body(res)).toEqual({ success: true, data: { started: true } })
    expect(publishSite).toHaveBeenCalledOnce()
  })

  it("answers 502 PUBLISH_FAILED with the message when Vercel refuses", async () => {
    vi.mocked(publishSite).mockRejectedValue(new UpstreamError("PUBLISH_FAILED", "Publishing couldn't start. Try again in a minute."))
    const res = await publish(event())
    expect(res.statusCode).toBe(502)
    expect(body(res).error).toEqual({ code: "PUBLISH_FAILED", message: "Publishing couldn't start. Try again in a minute." })
  })

  it.each([
    ["no token", null],
    ["an ID token", { ...adminClaims, token_use: "id" }],
    ["another app client's token", { ...adminClaims, client_id: "someoneelse" }],
  ])("refuses %s with 401 and never calls Vercel", async (_label, claims) => {
    const res = await publish(event(claims))
    expect(res.statusCode).toBe(401)
    expect(publishSite).not.toHaveBeenCalled()
  })
})
