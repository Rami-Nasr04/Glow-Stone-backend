import type { APIGatewayProxyEventV2 } from "aws-lambda"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ValidationError } from "../lib/errors"
import { PHOTO_MESSAGES } from "../lib/photoRules"
import { confirmUpload } from "../services/photoUploadService"
import { confirm } from "./adminPhotoUploadController"

vi.mock("../services/photoUploadService")

const POOL = "eu-central-1_TestPool1"
const CLIENT = "testclient123"
const UPLOAD = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b"
const adminClaims = {
  sub: "7334b882-0000",
  iss: `https://cognito-idp.eu-central-1.amazonaws.com/${POOL}`,
  token_use: "access",
  client_id: CLIENT,
}

const event = ({ id = "5", body, claims = adminClaims }: { id?: string; body?: string; claims?: Record<string, unknown> | null } = {}) =>
  ({
    pathParameters: { id },
    body,
    requestContext: claims ? { authorizer: { jwt: { claims } } } : {},
  }) as unknown as APIGatewayProxyEventV2

const body = (res: { body?: string }) => JSON.parse(res.body ?? "")

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("AWS_REGION", "eu-central-1")
  vi.stubEnv("ADMIN_USER_POOL_ID", POOL)
  vi.stubEnv("ADMIN_APP_CLIENT_ID", CLIENT)
})

describe("confirm (POST /admin/products/{id}/photos)", () => {
  it("refuses a request without an admin token before doing anything", async () => {
    const res = await confirm(event({ body: JSON.stringify({ uploadId: UPLOAD }), claims: null }))
    expect(res.statusCode).toBe(401)
    expect(confirmUpload).not.toHaveBeenCalled()
  })

  it("answers 201 with the new photo", async () => {
    const photo = { id: 41, url: "https://cdn.test/products/5/abcdefghij12", width: 1600, height: 2000, position: 4 }
    vi.mocked(confirmUpload).mockResolvedValue(photo)
    const res = await confirm(event({ body: JSON.stringify({ uploadId: UPLOAD }) }))
    expect(res.statusCode).toBe(201)
    expect(body(res).data).toEqual(photo)
    expect(confirmUpload).toHaveBeenCalledExactlyOnceWith(5, UPLOAD)
  })

  it.each([[undefined], [JSON.stringify({})], [JSON.stringify({ uploadId: "x" })]])(
    "says the upload wasn't found for body %s, without calling the service",
    async (raw) => {
      const res = await confirm(event({ body: raw }))
      expect(res.statusCode).toBe(400)
      expect(body(res).error.message).toBe(PHOTO_MESSAGES.uploadMissing)
      expect(confirmUpload).not.toHaveBeenCalled()
    },
  )

  it("refuses a bad piece id", async () => {
    const res = await confirm(event({ id: "abc", body: JSON.stringify({ uploadId: UPLOAD }) }))
    expect(body(res).error.message).toBe("Invalid product id")
  })

  it("passes the photo's refusal through as 400", async () => {
    vi.mocked(confirmUpload).mockRejectedValue(new ValidationError(PHOTO_MESSAGES.tooSmall))
    const res = await confirm(event({ body: JSON.stringify({ uploadId: UPLOAD }) }))
    expect(res.statusCode).toBe(400)
    expect(body(res).error).toEqual({ code: "VALIDATION", message: PHOTO_MESSAGES.tooSmall })
  })
})
