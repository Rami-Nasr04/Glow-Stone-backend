import type { APIGatewayProxyEventV2 } from "aws-lambda"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors"
import { PHOTO_MESSAGES } from "../lib/photoRules"
import { deletePhoto, reorderPhotos, requestUpload } from "../services/adminPhotoService"
import { remove, reorder, upload } from "./adminPhotoController"

vi.mock("../services/adminPhotoService")

const POOL = "eu-central-1_TestPool1"
const CLIENT = "testclient123"
const adminClaims = {
  sub: "7334b882-0000",
  iss: `https://cognito-idp.eu-central-1.amazonaws.com/${POOL}`,
  token_use: "access",
  client_id: CLIENT,
}

const event = ({
  params = { id: "5" },
  body,
  claims = adminClaims,
}: { params?: Record<string, string>; body?: string; claims?: Record<string, unknown> | null } = {}): APIGatewayProxyEventV2 =>
  ({
    pathParameters: params,
    body,
    requestContext: claims ? { authorizer: { jwt: { claims } } } : {},
  }) as unknown as APIGatewayProxyEventV2

const body = (res: { body?: string }) => JSON.parse(res.body ?? "")
const photo = { id: 3, url: "https://cdn.test/products/5/abcdefghij12", width: 2880, height: 1920, position: 1 }

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("AWS_REGION", "eu-central-1")
  vi.stubEnv("ADMIN_USER_POOL_ID", POOL)
  vi.stubEnv("ADMIN_APP_CLIENT_ID", CLIENT)
})

describe("every photo route", () => {
  it.each([
    ["upload", upload, {}],
    ["reorder", reorder, { body: JSON.stringify({ imageIds: [1] }) }],
    ["remove", remove, { params: { id: "5", imageId: "3" } }],
  ] as const)("%s refuses a request without an admin token before doing anything", async (_, handler, extra) => {
    const res = await handler(event({ ...extra, claims: null }))
    expect(res.statusCode).toBe(401)
    expect(requestUpload).not.toHaveBeenCalled()
    expect(reorderPhotos).not.toHaveBeenCalled()
    expect(deletePhoto).not.toHaveBeenCalled()
  })

  it("refuses an ID token (only access tokens are accepted)", async () => {
    const res = await upload(event({ claims: { ...adminClaims, token_use: "id" } }))
    expect(res.statusCode).toBe(401)
  })
})

describe("upload (POST /admin/products/{id}/photos/upload)", () => {
  it("returns the upload slot", async () => {
    const slot = { uploadId: "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b", url: "https://bucket.s3/", fields: { key: "k" } }
    vi.mocked(requestUpload).mockResolvedValue(slot)
    const res = await upload(event())
    expect(res.statusCode).toBe(200)
    expect(body(res).data).toEqual(slot)
    expect(requestUpload).toHaveBeenCalledExactlyOnceWith(5)
  })

  it("refuses a bad piece id", async () => {
    const res = await upload(event({ params: { id: "05" } }))
    expect(res.statusCode).toBe(400)
    expect(body(res).error.message).toBe("Invalid product id")
  })

  it("answers 409 when the piece is full", async () => {
    vi.mocked(requestUpload).mockRejectedValue(new ConflictError(PHOTO_MESSAGES.tooMany))
    const res = await upload(event())
    expect(res.statusCode).toBe(409)
    expect(body(res).error).toEqual({ code: "CONFLICT", message: PHOTO_MESSAGES.tooMany })
  })

  it("answers 404 for an unknown piece", async () => {
    vi.mocked(requestUpload).mockRejectedValue(new NotFoundError("Product not found"))
    expect((await upload(event())).statusCode).toBe(404)
  })
})

describe("reorder (PUT /admin/products/{id}/photos/order)", () => {
  it("returns the photos in their new order", async () => {
    vi.mocked(reorderPhotos).mockResolvedValue([photo])
    const res = await reorder(event({ body: JSON.stringify({ imageIds: [3] }) }))
    expect(res.statusCode).toBe(200)
    expect(body(res).data).toEqual([photo])
    expect(reorderPhotos).toHaveBeenCalledExactlyOnceWith(5, [3])
  })

  it("refuses a malformed list with the studio's message, without calling the service", async () => {
    const res = await reorder(event({ body: JSON.stringify({ imageIds: [] }) }))
    expect(res.statusCode).toBe(400)
    expect(body(res).error.message).toBe(PHOTO_MESSAGES.badOrder)
    expect(reorderPhotos).not.toHaveBeenCalled()
  })

  it("passes the service's refusal through", async () => {
    vi.mocked(reorderPhotos).mockRejectedValue(new ValidationError(PHOTO_MESSAGES.badOrder))
    const res = await reorder(event({ body: JSON.stringify({ imageIds: [1, 2] }) }))
    expect(body(res).error.message).toBe(PHOTO_MESSAGES.badOrder)
  })

  it("refuses a body that isn't JSON", async () => {
    expect((await reorder(event({ body: "{nope" }))).statusCode).toBe(400)
  })
})

describe("remove (DELETE /admin/products/{id}/photos/{imageId})", () => {
  it("answers 204 with no body", async () => {
    vi.mocked(deletePhoto).mockResolvedValue()
    const res = await remove(event({ params: { id: "5", imageId: "3" } }))
    expect(res.statusCode).toBe(204)
    expect(res.body).toBeUndefined()
    expect(deletePhoto).toHaveBeenCalledExactlyOnceWith(5, 3)
  })

  it("refuses a bad photo id", async () => {
    const res = await remove(event({ params: { id: "5", imageId: "x" } }))
    expect(res.statusCode).toBe(400)
    expect(body(res).error.message).toBe("Invalid photo id")
  })

  it("answers 404 for a photo the piece doesn't have", async () => {
    vi.mocked(deletePhoto).mockRejectedValue(new NotFoundError("Photo not found"))
    const res = await remove(event({ params: { id: "5", imageId: "3" } }))
    expect(res.statusCode).toBe(404)
    expect(body(res).error.message).toBe("Photo not found")
  })
})
