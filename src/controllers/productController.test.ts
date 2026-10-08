import type { APIGatewayProxyEventV2 } from "aws-lambda"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NotFoundError } from "../lib/errors"
import { getProduct, listProducts } from "../services/productService"
import type { Product } from "../types/catalog"
import { get, list } from "./productController"

vi.mock("../services/productService")

const product: Product = {
  id: 3,
  name: "Batroun",
  stoneType: "Limestone",
  color: "Cream",
  price: 890,
  bottles: 14,
  heightCm: 118,
  widthCm: 36,
  depthCm: 20,
  weightKg: 72,
  editionSize: 8,
  remaining: 4,
  soldOut: false,
  featured: true,
  summary: "Tall slab.",
  createdAt: "2026-10-03T09:00:00.000Z",
  story: null,
}

const eventWithId = (id: string): APIGatewayProxyEventV2 =>
  ({ pathParameters: { id } }) as unknown as APIGatewayProxyEventV2

const body = (res: { body?: string }) => JSON.parse(res.body ?? "")

beforeEach(() => {
  vi.resetAllMocks()
})

describe("GET /products", () => {
  it("returns the published products in the envelope", async () => {
    const { story: _story, ...summary } = product
    vi.mocked(listProducts).mockResolvedValue([summary])
    const res = await list()
    expect(res.statusCode).toBe(200)
    expect(body(res)).toEqual({ success: true, data: [summary] })
  })

  it("turns an unexpected failure into a 500 without details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(listProducts).mockRejectedValue(new Error("connection refused"))
    const res = await list()
    expect(res.statusCode).toBe(500)
    expect(body(res).error.code).toBe("INTERNAL")
    expect(res.body).not.toContain("connection refused")
  })
})

describe("GET /products/{id}", () => {
  it("returns one product", async () => {
    vi.mocked(getProduct).mockResolvedValue(product)
    const res = await get(eventWithId("3"))
    expect(res.statusCode).toBe(200)
    expect(body(res).data).toEqual(product)
    expect(getProduct).toHaveBeenCalledWith(3)
  })

  it("answers 400 for an id that isn't a positive whole number, without asking the database", async () => {
    const res = await get(eventWithId("abc"))
    expect(res.statusCode).toBe(400)
    expect(body(res).error).toEqual({ code: "VALIDATION", message: "Invalid product id" })
    expect(getProduct).not.toHaveBeenCalled()
  })

  it("answers 404 for a draft or unknown product", async () => {
    vi.mocked(getProduct).mockRejectedValue(new NotFoundError("Product not found"))
    const res = await get(eventWithId("99"))
    expect(res.statusCode).toBe(404)
    expect(body(res).error).toEqual({ code: "NOT_FOUND", message: "Product not found" })
  })
})
