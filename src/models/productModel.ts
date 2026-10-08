import { executeQuery } from "../lib/db"

// One row of `products` as the public endpoints read it (numeric columns arrive as numbers, see lib/db).
export interface ProductRow {
  id: number
  name: string
  stone_type: string
  color: string
  price: number
  bottles: number
  height_cm: number | null
  width_cm: number | null
  depth_cm: number | null
  weight_kg: number | null
  edition_size: number
  remaining: number
  featured: boolean
  summary: string | null
  created_at: Date
}

export interface ProductDetailRow extends ProductRow {
  story: string | null
}

const SUMMARY_COLUMNS = `id, name, stone_type, color, price, bottles, height_cm, width_cm, depth_cm, weight_kg,
  edition_size, remaining, featured, summary, created_at`

export async function findPublishedProducts(): Promise<ProductRow[]> {
  return executeQuery<ProductRow>(
    `select ${SUMMARY_COLUMNS} from products where status = 'published' order by created_at desc, id desc`,
  )
}

export async function findPublishedProductById(id: number): Promise<ProductDetailRow | null> {
  const rows = await executeQuery<ProductDetailRow>(
    `select ${SUMMARY_COLUMNS}, story from products where id = $1 and status = 'published'`,
    [id],
  )
  return rows[0] ?? null
}
