import { NotFoundError } from "../lib/errors"
import type { ProductDetailRow, ProductRow } from "../models/productModel"
import { findPublishedProductById, findPublishedProducts } from "../models/productModel"
import type { Product, ProductSummary } from "../types/catalog"

function toSummary(row: ProductRow): ProductSummary {
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
  }
}

function toProduct(row: ProductDetailRow): Product {
  return { ...toSummary(row), story: row.story }
}

// Published products, newest first.
export async function listProducts(): Promise<ProductSummary[]> {
  const rows = await findPublishedProducts()
  return rows.map(toSummary)
}

// One published product; a draft or an unknown id is "not found" (drafts never leak).
export async function getProduct(id: number): Promise<Product> {
  const row = await findPublishedProductById(id)
  if (!row) throw new NotFoundError("Product not found")
  return toProduct(row)
}
