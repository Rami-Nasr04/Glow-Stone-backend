import { beforeEach, describe, expect, it, vi } from "vitest"
import { NotFoundError } from "../lib/errors"
import type { ProductDetailRow } from "../models/productModel"
import { findPublishedProductById, findPublishedProducts } from "../models/productModel"
import { getProduct, listProducts } from "./productService"

vi.mock("../models/productModel")

const row: ProductDetailRow = {
  id: 8,
  name: "Sannine · Sand",
  stone_type: "Limestone",
  color: "Warm beige",
  price: 420,
  bottles: 5,
  height_cm: 72,
  width_cm: 28,
  depth_cm: 14,
  weight_kg: null,
  edition_size: 12,
  remaining: 3,
  featured: true,
  summary: "Slab with a hand-broken top.",
  created_at: new Date("2026-10-08T09:00:00Z"),
  story: "One.\n\nTwo.",
}

const summary = {
  id: 8,
  name: "Sannine · Sand",
  stoneType: "Limestone",
  color: "Warm beige",
  price: 420,
  bottles: 5,
  heightCm: 72,
  widthCm: 28,
  depthCm: 14,
  weightKg: null,
  editionSize: 12,
  remaining: 3,
  soldOut: false,
  featured: true,
  summary: "Slab with a hand-broken top.",
  createdAt: "2026-10-08T09:00:00.000Z",
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("listProducts()", () => {
  it("maps rows to the contract, without the story, in the model's order", async () => {
    const { story: _story, ...listRow } = row
    vi.mocked(findPublishedProducts).mockResolvedValue([listRow, { ...listRow, id: 7, remaining: 0 }])
    const products = await listProducts()
    expect(products[0]).toStrictEqual(summary)
    expect(products[1]).toMatchObject({ id: 7, remaining: 0, soldOut: true })
  })
})

describe("getProduct()", () => {
  it("returns the product with its story", async () => {
    vi.mocked(findPublishedProductById).mockResolvedValue(row)
    expect(await getProduct(8)).toStrictEqual({ ...summary, story: "One.\n\nTwo." })
    expect(findPublishedProductById).toHaveBeenCalledWith(8)
  })

  it("throws NotFoundError when there is no published product with that id", async () => {
    vi.mocked(findPublishedProductById).mockResolvedValue(null)
    await expect(getProduct(99)).rejects.toThrow(NotFoundError)
  })
})
