import { beforeEach, describe, expect, it, vi } from "vitest"
import { NotFoundError } from "../lib/errors"
import { findProductImages } from "../models/productImageModel"
import type { ProductDetailRow } from "../models/productModel"
import { findPublishedProductById, findPublishedProducts } from "../models/productModel"
import { getProduct, listProducts } from "./productService"

vi.mock("../models/productModel")
vi.mock("../models/productImageModel")

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
  images: [],
}

// Rows carry the id and position (the studio needs them); the public answer must not.
const image = (product_id: number, name: string) => ({
  id: product_id * 100 + name.charCodeAt(0),
  product_id,
  position: 1,
  url: `https://cdn.test/products/${product_id}/${name}`,
  width: 2048,
  height: 3072,
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(findProductImages).mockResolvedValue([])
})

describe("listProducts()", () => {
  it("maps rows to the contract, without the story, in the model's order", async () => {
    const { story: _story, ...listRow } = row
    vi.mocked(findPublishedProducts).mockResolvedValue([listRow, { ...listRow, id: 7, remaining: 0 }])
    const products = await listProducts()
    expect(products[0]).toStrictEqual(summary)
    expect(products[1]).toMatchObject({ id: 7, remaining: 0, soldOut: true })
  })

  it("adds each piece's first 2 photos with one query for all pieces", async () => {
    const { story: _story, ...listRow } = row
    vi.mocked(findPublishedProducts).mockResolvedValue([listRow, { ...listRow, id: 7 }, { ...listRow, id: 5 }])
    vi.mocked(findProductImages).mockResolvedValue([image(5, "eeeeeeeeeeee"), image(8, "aaaaaaaaaaaa"), image(8, "bbbbbbbbbbbb")])
    const products = await listProducts()
    expect(findProductImages).toHaveBeenCalledTimes(1)
    expect(findProductImages).toHaveBeenCalledWith([8, 7, 5], 2)
    expect(products.map((p) => p.images.map((i) => i.url.slice(-12)))).toEqual([["aaaaaaaaaaaa", "bbbbbbbbbbbb"], [], ["eeeeeeeeeeee"]])
    expect(products[0].images[0]).toStrictEqual({ url: "https://cdn.test/products/8/aaaaaaaaaaaa", width: 2048, height: 3072 })
  })

  it("asks for no photos when there are no pieces", async () => {
    vi.mocked(findPublishedProducts).mockResolvedValue([])
    expect(await listProducts()).toEqual([])
    expect(findProductImages).not.toHaveBeenCalled()
  })
})

describe("getProduct()", () => {
  it("returns the product with its story", async () => {
    vi.mocked(findPublishedProductById).mockResolvedValue(row)
    expect(await getProduct(8)).toStrictEqual({ ...summary, story: "One.\n\nTwo." })
    expect(findPublishedProductById).toHaveBeenCalledWith(8)
  })

  it("returns all of its photos, in order", async () => {
    vi.mocked(findPublishedProductById).mockResolvedValue(row)
    vi.mocked(findProductImages).mockResolvedValue([image(8, "aaaaaaaaaaaa"), image(8, "bbbbbbbbbbbb"), image(8, "cccccccccccc")])
    const product = await getProduct(8)
    expect(findProductImages).toHaveBeenCalledWith([8])
    expect(product.images.map((i) => i.url.slice(-12))).toEqual(["aaaaaaaaaaaa", "bbbbbbbbbbbb", "cccccccccccc"])
    for (const img of product.images) expect(Object.keys(img)).toEqual(["url", "width", "height"])
  })

  it("throws NotFoundError when there is no published product with that id", async () => {
    vi.mocked(findPublishedProductById).mockResolvedValue(null)
    await expect(getProduct(99)).rejects.toThrow(NotFoundError)
    expect(findProductImages).not.toHaveBeenCalled() // a draft's photos never leak
  })
})
