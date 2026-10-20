import { requiredEnv } from "../lib/env"
import { ConflictError, NotFoundError } from "../lib/errors"
import { deleteFolder } from "../lib/s3"
import { findProductImages } from "../models/productImageModel"
import type { AdminProductRow } from "../models/productModel"
import { deleteDraftProduct, findAllProducts, findProductById, insertProduct, updateProduct } from "../models/productModel"
import type { ProductInput, ProductPatch } from "../schemas/product.schema"
import type { ProductImageRow } from "../models/productImageModel"
import type { AdminProduct, AdminProductImage } from "../types/catalog"
import { groupByProduct, LIST_IMAGES_PER_PRODUCT, toSummary } from "./productService"

export const toAdminImage = ({ id, url, width, height, position }: ProductImageRow): AdminProductImage => ({
  id,
  url,
  width,
  height,
  position,
})

const adminImagesByProduct = (rows: ProductImageRow[]) => groupByProduct(rows, toAdminImage)

function toAdminProduct(row: AdminProductRow, images: AdminProductImage[]): AdminProduct {
  return { ...toSummary(row, []), images, story: row.story, status: row.status, updatedAt: row.updated_at.toISOString() }
}

async function withAllImages(row: AdminProductRow): Promise<AdminProduct> {
  return toAdminProduct(row, adminImagesByProduct(await findProductImages([row.id])).get(row.id) ?? [])
}

// Every piece, drafts included, newest first, each with its first 2 photos (2 queries in all).
export async function listAdminProducts(): Promise<AdminProduct[]> {
  const rows = await findAllProducts()
  if (rows.length === 0) return []
  const images = adminImagesByProduct(await findProductImages(rows.map((r) => r.id), LIST_IMAGES_PER_PRODUCT))
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

// Drafts only: a published piece must be set to draft first, so a live piece is never deleted with one click.
// The rows go first (that is what the website reads), then every file in the piece's photo folder. A failed file
// delete only leaves unused files behind (nothing links to them), so it is logged, not returned.
export async function deleteProduct(id: number): Promise<void> {
  const result = await deleteDraftProduct(id)
  if (result === null) throw new NotFoundError("Product not found")
  if (result === "published") throw new ConflictError("Set this piece to draft before deleting it.")
  const folder = `products/${id}/`
  try {
    await deleteFolder(requiredEnv("IMAGES_BUCKET"), folder)
  } catch (err) {
    console.error("Photo files of a deleted piece were left:", folder, err)
  }
}
