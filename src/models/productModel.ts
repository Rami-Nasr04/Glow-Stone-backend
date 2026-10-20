import { executeQuery, withTransaction } from "../lib/db"
import { ValidationError } from "../lib/errors"
import type { ProductInput, ProductPatch } from "../schemas/product.schema"

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

// One row as the admin endpoints read it: drafts too, with status and updated_at.
export interface AdminProductRow extends ProductDetailRow {
  status: "draft" | "published"
  updated_at: Date
}

const ADMIN_COLUMNS = `${SUMMARY_COLUMNS}, story, status, updated_at`

// The API's field names → the table's columns. Only these columns can ever be written.
const WRITABLE_COLUMNS: Record<keyof ProductPatch, string> = {
  name: "name",
  stoneType: "stone_type",
  color: "color",
  price: "price",
  bottles: "bottles",
  heightCm: "height_cm",
  widthCm: "width_cm",
  depthCm: "depth_cm",
  weightKg: "weight_kg",
  editionSize: "edition_size",
  remaining: "remaining",
  status: "status",
  featured: "featured",
  summary: "summary",
  story: "story",
}

// The sent fields as [column, value] pairs; a field left out (undefined) is not touched.
function columnValues(fields: ProductPatch): [string, unknown][] {
  return (Object.keys(WRITABLE_COLUMNS) as (keyof ProductPatch)[])
    .filter((key) => fields[key] !== undefined)
    .map((key) => [WRITABLE_COLUMNS[key], fields[key]])
}

export async function findAllProducts(): Promise<AdminProductRow[]> {
  return executeQuery<AdminProductRow>(`select ${ADMIN_COLUMNS} from products order by created_at desc, id desc`)
}

export async function findProductById(id: number): Promise<AdminProductRow | null> {
  const rows = await executeQuery<AdminProductRow>(`select ${ADMIN_COLUMNS} from products where id = $1`, [id])
  return rows[0] ?? null
}

// Fields left out take the table's defaults (status draft, featured false, the rest null).
export async function insertProduct(input: ProductInput): Promise<AdminProductRow> {
  const pairs = columnValues(input)
  const rows = await executeQuery<AdminProductRow>(
    `insert into products (${pairs.map(([column]) => column).join(", ")})
     values (${pairs.map((_, i) => `$${i + 1}`).join(", ")})
     returning ${ADMIN_COLUMNS}`,
    pairs.map(([, value]) => value),
  )
  return rows[0]
}

// Changes only the sent fields, in one statement (the database checks its rules against the saved row).
// null = no such product.
export async function updateProduct(id: number, changes: ProductPatch): Promise<AdminProductRow | null> {
  const pairs = columnValues(changes)
  if (pairs.length === 0) throw new ValidationError("Send at least one field to change")
  const rows = await executeQuery<AdminProductRow>(
    `update products set ${pairs.map(([column], i) => `${column} = $${i + 2}`).join(", ")}
     where id = $1
     returning ${ADMIN_COLUMNS}`,
    [id, ...pairs.map(([, value]) => value)],
  )
  return rows[0] ?? null
}

// Deletes a draft and its photo rows in one transaction (the photo rows first: their link to the piece has no
// cascade). The piece's row is locked first, so it can't be published, or get a photo, halfway through.
// "published" = refused, nothing deleted; null = no such piece.
export async function deleteDraftProduct(id: number): Promise<"deleted" | "published" | null> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<Pick<AdminProductRow, "status">>("select status from products where id = $1 for update", [id])
    if (rows.length === 0) return null
    if (rows[0].status !== "draft") return "published"
    await client.query("delete from product_images where product_id = $1", [id])
    await client.query("delete from products where id = $1", [id])
    return "deleted"
  })
}
