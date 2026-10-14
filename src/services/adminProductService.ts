import { NotFoundError } from "../lib/errors"
import { findProductImages } from "../models/productImageModel"
import type { AdminProductRow } from "../models/productModel"
import { findAllProducts, findProductById, insertProduct, updateProduct } from "../models/productModel"
import type { ProductInput, ProductPatch } from "../schemas/product.schema"
import type { AdminProduct, ProductImage } from "../types/catalog"
import { imagesByProduct, LIST_IMAGES_PER_PRODUCT, toSummary } from "./productService"

function toAdminProduct(row: AdminProductRow, images: ProductImage[]): AdminProduct {
  return { ...toSummary(row, images), story: row.story, status: row.status, updatedAt: row.updated_at.toISOString() }
}

async function withAllImages(row: AdminProductRow): Promise<AdminProduct> {
  return toAdminProduct(row, imagesByProduct(await findProductImages([row.id])).get(row.id) ?? [])
}

// Every piece, drafts included, newest first, each with its first 2 photos (2 queries in all).
export async function listAdminProducts(): Promise<AdminProduct[]> {
  const rows = await findAllProducts()
  if (rows.length === 0) return []
  const images = imagesByProduct(await findProductImages(rows.map((r) => r.id), LIST_IMAGES_PER_PRODUCT))
  return rows.map((row) => toAdminProduct(row, images.get(row.id) ?? []))
}

// One piece, whatever its status, with all its photos.
export async function getAdminProduct(id: number): Promise<AdminProduct> {
  const row = await findProductById(id)
  if (!row) throw new NotFoundError("Product not found")
  return withAllImages(row)
}

// A new piece has no photos yet.
export async function createProduct(input: ProductInput): Promise<AdminProduct> {
  return toAdminProduct(await insertProduct(input), [])
}

export async function updateAdminProduct(id: number, changes: ProductPatch): Promise<AdminProduct> {
  const row = await updateProduct(id, changes)
  if (!row) throw new NotFoundError("Product not found")
  return withAllImages(row)
}
