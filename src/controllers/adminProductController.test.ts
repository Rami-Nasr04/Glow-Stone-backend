import type { APIGatewayProxyEventV2 } from "aws-lambda"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ConflictError, NotFoundError } from "../lib/errors"
import {
  createProduct,
  deleteProduct,
  getAdminProduct,
  listAdminProducts,
  updateAdminProduct,
} from "../services/adminProductService"
import type { AdminProduct } from "../types/catalog"
import { create, get, list, remove, update } from "./adminProductController"

vi.mock("../services/adminProductService")

const POOL = "eu-central-1_TestPool1"
const CLIENT = "testclient123"
const adminClaims = {
  sub: "7334b882-0000",
  iss: `https://cognito-idp.eu-central-1.amazonaws.com/${POOL}`,
  token_use: "access",
  client_id: CLIENT,
}

const product: AdminProduct = {
  id: 7,
  name: "Arz",
  stoneType: "Limestone",
  color: "Warm beige",
  price: 1120.5,
  bottles: 6,
  heightCm: null,
  widthCm: null,
  depthCm: null,
  weightKg: null,
  editionSize: 10,
  remaining: 10,
  soldOut: false,
  featured: false,
  summary: null,
  createdAt: "2026-10-14T09:00:00.000Z",
  images: [],
  story: null,
  status: "draft",
  updatedAt: "2026-10-14T09:00:00.000Z",
}

const input = { name: "Arz", stoneType: "Limestone", color: "Warm beige", price: 1120.5, bottles: 6, editionSize: 10, remaining: 10 }

const event = (
  { id, body, claims = adminClaims }: { id?: string; body?: string; claims?: Record<string, unknown> | null } = {},
): APIGatewayProxyEventV2 =>
  ({
    pathParameters: id === undefined ? undefined : { id },
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

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("every admin route", () => {
  it.each([
    ["GET list", () => list(event({ claims: null }))],
    ["GET one", () => get(event({ id: "7", claims: null }))],
    ["POST", () => create(event({ body: JSON.stringify(input), claims: null }))],
    ["PATCH", () => update(event({ id: "7", body: '{"price":1}', claims: null }))],
    ["DELETE", () => remove(event({ id: "7", claims: null }))],
    ["GET list with an ID token", () => list(event({ claims: { ...adminClaims, token_use: "id" } }))],
  ])("refuses %s without an admin access token, before touching data", async (_label, call) => {
    const res = await call()
    expect(res.statusCode).toBe(401)
    expect(body(res).error.code).toBe("UNAUTHORIZED")
    for (const service of [listAdminProducts, getAdminProduct, createProduct, updateAdminProduct, deleteProduct]) {
      expect(service).not.toHaveBeenCalled()
    }
  })
})

describe("GET /admin/products", () => {
  it("returns every piece in the envelope", async () => {
    vi.mocked(listAdminProducts).mockResolvedValue([product])
    const res = await list(event())
    expect(res.statusCode).toBe(200)
    expect(body(res)).toEqual({ success: true, data: [product] })
  })
})

describe("GET /admin/products/{id}", () => {
  it("returns one piece", async () => {
    vi.mocked(getAdminProduct).mockResolvedValue(product)
    const res = await get(event({ id: "7" }))
    expect(getAdminProduct).toHaveBeenCalledExactlyOnceWith(7)
    expect(body(res).data).toEqual(product)
  })

  it("answers 400 for a bad id and 404 for an unknown one", async () => {
    expect((await get(event({ id: "abc" }))).statusCode).toBe(400)
    vi.mocked(getAdminProduct).mockRejectedValue(new NotFoundError("Product not found"))
    expect((await get(event({ id: "99" }))).statusCode).toBe(404)
  })
})

describe("POST /admin/products", () => {
  it("creates a piece from valid input and answers 201", async () => {
    vi.mocked(createProduct).mockResolvedValue(product)
    const res = await create(event({ body: JSON.stringify({ ...input, name: "  Arz " }) }))
    expect(res.statusCode).toBe(201)
    expect(createProduct).toHaveBeenCalledExactlyOnceWith(input)
    expect(body(res).data).toEqual(product)
  })

  it("refuses invalid input with the field's message", async () => {
    const res = await create(event({ body: JSON.stringify({ ...input, price: 0 }) }))
    expect(res.statusCode).toBe(400)
    expect(body(res).error).toEqual({ code: "VALIDATION", message: "price must be more than 0" })
    expect(createProduct).not.toHaveBeenCalled()
  })

  it("refuses a body that isn't JSON", async () => {
    expect((await create(event({ body: "{name:" }))).statusCode).toBe(400)
  })

  it("refuses a missing body", async () => {
    expect(body(await create(event())).error.message).toBe("name is required")
  })
})

describe("PATCH /admin/products/{id}", () => {
  it("sends only the fields given", async () => {
    vi.mocked(updateAdminProduct).mockResolvedValue({ ...product, status: "published" })
    const res = await update(event({ id: "7", body: '{"status":"published"}' }))
    expect(res.statusCode).toBe(200)
    expect(updateAdminProduct).toHaveBeenCalledExactlyOnceWith(7, { status: "published" })
  })

  it("refuses an empty change and a bad id before calling the service", async () => {
    expect(body(await update(event({ id: "7", body: "{}" }))).error.message).toBe("Send at least one field to change")
    expect((await update(event({ id: "0", body: '{"price":1}' }))).statusCode).toBe(400)
    expect(updateAdminProduct).not.toHaveBeenCalled()
  })

  it("answers 404 for an unknown id", async () => {
    vi.mocked(updateAdminProduct).mockRejectedValue(new NotFoundError("Product not found"))
    expect((await update(event({ id: "99", body: '{"price":1}' }))).statusCode).toBe(404)
  })
})

describe("DELETE /admin/products/{id}", () => {
  it("deletes the piece and answers 204 with an empty body", async () => {
    vi.mocked(deleteProduct).mockResolvedValue()
    const res = await remove(event({ id: "13" }))
    expect(res.statusCode).toBe(204)
    expect(res.body).toBeUndefined()
    expect(deleteProduct).toHaveBeenCalledExactlyOnceWith(13)
  })

  it("answers 409 with the message for a published piece", async () => {
    vi.mocked(deleteProduct).mockRejectedValue(new ConflictError("Set this piece to draft before deleting it."))
    const res = await remove(event({ id: "4" }))
    expect(res.statusCode).toBe(409)
    expect(body(res).error).toEqual({ code: "CONFLICT", message: "Set this piece to draft before deleting it." })
  })

  it("answers 404 for an unknown piece", async () => {
    vi.mocked(deleteProduct).mockRejectedValue(new NotFoundError("Product not found"))
    const res = await remove(event({ id: "99" }))
    expect(res.statusCode).toBe(404)
    expect(body(res).error.code).toBe("NOT_FOUND")
  })

  it.each(["abc", "0", "-1", "1.5"])("answers 400 for the id %s without calling the service", async (id) => {
    const res = await remove(event({ id }))
    expect(res.statusCode).toBe(400)
    expect(deleteProduct).not.toHaveBeenCalled()
  })
})
