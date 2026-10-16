import { beforeEach, describe, expect, it, vi } from "vitest"
import { NotFoundError } from "../lib/errors"
import { findProductImages } from "../models/productImageModel"
import type { AdminProductRow } from "../models/productModel"
import { findAllProducts, findProductById, insertProduct, updateProduct } from "../models/productModel"
import type { AdminProduct } from "../types/catalog"
import { createProduct, getAdminProduct, listAdminProducts, updateAdminProduct } from "./adminProductService"

vi.mock("../models/productModel")
vi.mock("../models/productImageModel")

const row: AdminProductRow = {
  id: 7,
  name: "Arz",
  stone_type: "Limestone",
  color: "Warm beige",
  price: 1120.5,
  bottles: 6,
  height_cm: 72.5,
  width_cm: null,
  depth_cm: null,
  weight_kg: null,
  edition_size: 10,
  remaining: 0,
  featured: false,
  summary: null,
  created_at: new Date("2026-10-14T09:00:00Z"),
  story: "One.\n\nTwo.",
  status: "draft",
  updated_at: new Date("2026-10-14T10:30:00Z"),
}

const photo = (productId: number, n: number) => ({
  id: productId * 10 + n,
  product_id: productId,
  url: `https://cdn.test/products/${productId}/photo${n}aaaaaa`,
  width: 2880,
  height: 4318,
  position: n,
})

const expected: AdminProduct = {
  id: 7,
  name: "Arz",
  stoneType: "Limestone",
  color: "Warm beige",
  price: 1120.5,
  bottles: 6,
  heightCm: 72.5,
  widthCm: null,
  depthCm: null,
  weightKg: null,
  editionSize: 10,
  remaining: 0,
  soldOut: true,
  featured: false,
  summary: null,
  createdAt: "2026-10-14T09:00:00.000Z",
  images: [],
  story: "One.\n\nTwo.",
  status: "draft",
  updatedAt: "2026-10-14T10:30:00.000Z",
}

const input = { name: "Arz", stoneType: "Limestone", color: "Warm beige", price: 1120.5, bottles: 6, editionSize: 10, remaining: 0 }

beforeEach(() => {
  vi.resetAllMocks()
})

describe("listAdminProducts()", () => {
  it("returns every piece with its first 2 photos, in one photo query", async () => {
    vi.mocked(findAllProducts).mockResolvedValue([row, { ...row, id: 3, status: "published" }])
    vi.mocked(findProductImages).mockResolvedValue([photo(3, 1), photo(3, 2)])
    const list = await listAdminProducts()
    expect(findProductImages).toHaveBeenCalledExactlyOnceWith([7, 3], 2)
    expect(list[0]).toEqual(expected)
    expect(list[1]).toMatchObject({ id: 3, status: "published" })
    expect(list[1].images.map((i) => i.url)).toEqual([photo(3, 1).url, photo(3, 2).url])
  })

  it("skips the photo query when there are no pieces", async () => {
    vi.mocked(findAllProducts).mockResolvedValue([])
    expect(await listAdminProducts()).toEqual([])
    expect(findProductImages).not.toHaveBeenCalled()
  })
})

describe("getAdminProduct()", () => {
  it("returns a draft too, with all its photos", async () => {
    vi.mocked(findProductById).mockResolvedValue(row)
    vi.mocked(findProductImages).mockResolvedValue([photo(7, 1), photo(7, 2), photo(7, 3)])
    const product = await getAdminProduct(7)
    expect(findProductImages).toHaveBeenCalledExactlyOnceWith([7])
    expect(product.images).toHaveLength(3)
    expect(product.status).toBe("draft")
    // The studio reorders and deletes by id, so admin photos carry their id and place (nothing else).
    expect(product.images[0]).toStrictEqual({ id: 71, url: photo(7, 1).url, width: 2880, height: 4318, position: 1 })
    expect(product.images.map((i) => i.position)).toEqual([1, 2, 3])
  })

  it("is not found for an unknown id, without looking for photos", async () => {
    vi.mocked(findProductById).mockResolvedValue(null)
    await expect(getAdminProduct(99)).rejects.toThrow(NotFoundError)
    expect(findProductImages).not.toHaveBeenCalled()
  })
})

describe("createProduct()", () => {
  it("returns the new piece with no photos and no photo query", async () => {
    vi.mocked(insertProduct).mockResolvedValue(row)
    expect(await createProduct(input)).toEqual(expected)
    expect(insertProduct).toHaveBeenCalledExactlyOnceWith(input)
    expect(findProductImages).not.toHaveBeenCalled()
  })
})

describe("updateAdminProduct()", () => {
  it("returns the changed piece with all its photos", async () => {
    vi.mocked(updateProduct).mockResolvedValue({ ...row, status: "published" })
    vi.mocked(findProductImages).mockResolvedValue([photo(7, 1)])
    const product = await updateAdminProduct(7, { status: "published" })
    expect(updateProduct).toHaveBeenCalledExactlyOnceWith(7, { status: "published" })
    expect(product).toMatchObject({ status: "published", images: [{ id: 71, url: photo(7, 1).url, width: 2880, height: 4318, position: 1 }] })
  })

  it("is not found for an unknown id, without looking for photos", async () => {
    vi.mocked(updateProduct).mockResolvedValue(null)
    await expect(updateAdminProduct(99, { price: 1 })).rejects.toThrow(NotFoundError)
    expect(findProductImages).not.toHaveBeenCalled()
  })
})
