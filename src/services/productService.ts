import { NotFoundError } from "../lib/errors"
import type { ProductImageRow } from "../models/productImageModel"
import { findProductImages } from "../models/productImageModel"
import type { ProductRow } from "../models/productModel"
import { findPublishedProductById, findPublishedProducts } from "../models/productModel"
import type { Product, ProductImage, ProductSummary } from "../types/catalog"

export const LIST_IMAGES_PER_PRODUCT = 2 // cover + hover on the collection card

// Each piece's photos, in the rows' order, shaped by toImage.
export function groupByProduct<T>(rows: ProductImageRow[], toImage: (row: ProductImageRow) => T): Map<number, T[]> {
  const grouped = new Map<number, T[]>()
  for (const row of rows) grouped.set(row.product_id, [...(grouped.get(row.product_id) ?? []), toImage(row)])
  return grouped
}

// The public shape only: the photo ids and positions stay inside the studio.
export function imagesByProduct(rows: ProductImageRow[]): Map<number, ProductImage[]> {
  return groupByProduct(rows, ({ url, width, height }) => ({ url, width, height }))
}

export function toSummary(row: ProductRow, images: ProductImage[]): ProductSummary {
  return {
    id: row.id,
    name: row.name,
    stoneType: row.stone_type,
    color: row.color,
    price: row.price,
    bottles: row.bottles,
    heightCm: row.height_cm,
    widthCm: row.width_cm,
    depthCm: row.depth_cm,
    weightKg: row.weight_kg,
    editionSize: row.edition_size,
    remaining: row.remaining,
    soldOut: row.remaining === 0,
    featured: row.featured,
    summary: row.summary,
    createdAt: row.created_at.toISOString(),
    images,
  }
}

// Published products, newest first, each with its first 2 photos (2 queries in all, whatever the number of pieces).
export async function listProducts(): Promise<ProductSummary[]> {
  const rows = await findPublishedProducts()
  if (rows.length === 0) return []
  const images = imagesByProduct(await findProductImages(rows.map((r) => r.id), LIST_IMAGES_PER_PRODUCT))
  return rows.map((row) => toSummary(row, images.get(row.id) ?? []))
}

// One published product; a draft or an unknown id is "not found" (drafts never leak).
export async function getProduct(id: number): Promise<Product> {
  const row = await findPublishedProductById(id)
  if (!row) throw new NotFoundError("Product not found")
  const images = imagesByProduct(await findProductImages([id])).get(id) ?? []
  return { ...toSummary(row, images), story: row.story }
}
