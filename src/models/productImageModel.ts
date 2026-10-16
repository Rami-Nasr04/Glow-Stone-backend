import type { PoolClient } from "pg"
import { executeQuery, withTransaction } from "../lib/db"
import { ConflictError, ValidationError } from "../lib/errors"
import { MAX_PHOTOS, PHOTO_MESSAGES } from "../lib/photoRules"

export interface ProductImageRow {
  id: number
  product_id: number
  url: string
  width: number
  height: number
  position: number
}

// Photos of several pieces in one query (never one query per piece), each piece's in position order.
// perProduct keeps only each piece's first N photos (the list shows cover + hover); null = all.
export async function findProductImages(productIds: number[], perProduct: number | null = null): Promise<ProductImageRow[]> {
  if (productIds.length === 0) return []
  return executeQuery<ProductImageRow>(
    `select id, product_id, url, width, height, position
     from (
       select id, product_id, url, width, height, position,
              row_number() over (partition by product_id order by position) as rank
       from product_images
       where product_id = any($1::int[])
     ) ranked
     where $2::int is null or rank <= $2::int
     order by product_id, position`,
    [productIds, perProduct],
  )
}

const IMAGE_COLUMNS = "id, product_id, url, width, height, position"

// How many photos a piece has; null = no such piece.
export async function countProductImages(productId: number): Promise<number | null> {
  const rows = await executeQuery<{ count: number }>(
    "select (select count(*)::int from product_images where product_id = p.id) as count from products p where p.id = $1",
    [productId],
  )
  return rows[0]?.count ?? null
}

// Every change to a piece's photos first locks the piece's row, so changes to the same piece run one after
// another (two uploads finishing together get the next two places; a reorder never misses a new photo).
async function lockProduct(client: PoolClient, productId: number): Promise<boolean> {
  const { rowCount } = await client.query("select 1 from products where id = $1 for update", [productId])
  return rowCount === 1
}

export interface NewPhoto {
  url: string
  width: number
  height: number
}

// Adds the photo after the piece's last one. null = no such piece; the 31st photo is refused.
export async function addProductImage(productId: number, photo: NewPhoto): Promise<ProductImageRow | null> {
  return withTransaction(async (client) => {
    if (!(await lockProduct(client, productId))) return null
    const { rows } = await client.query<ProductImageRow>(
      `insert into product_images (product_id, url, width, height, position)
       select $1, $2, $3, $4, coalesce(max(position), 0) + 1 from product_images where product_id = $1
       having count(*) < $5
       returning ${IMAGE_COLUMNS}`,
      [productId, photo.url, photo.width, photo.height, MAX_PHOTOS],
    )
    if (rows.length === 0) throw new ConflictError(PHOTO_MESSAGES.tooMany)
    return rows[0]
  })
}

// imageIds = every photo of the piece, exactly once, in the new order (positions become 1..n).
// null = no such piece. Checked under the lock, so a list read before another change is refused.
export async function reorderProductImages(productId: number, imageIds: number[]): Promise<ProductImageRow[] | null> {
  return withTransaction(async (client) => {
    if (!(await lockProduct(client, productId))) return null
    const { rows: current } = await client.query<{ id: number }>("select id from product_images where product_id = $1", [
      productId,
    ])
    const sent = new Set(imageIds)
    const exact =
      sent.size === imageIds.length && sent.size === current.length && current.every(({ id }) => sent.has(id))
    if (!exact) throw new ValidationError(PHOTO_MESSAGES.badOrder)
    // One statement: the deferrable (product_id, position) rule is checked when it ends, so swaps are fine.
    await client.query(
      `update product_images p set position = o.ord
       from unnest($2::int[]) with ordinality as o(id, ord)
       where p.id = o.id and p.product_id = $1`,
      [productId, imageIds],
    )
    const { rows } = await client.query<ProductImageRow>(
      `select ${IMAGE_COLUMNS} from product_images where product_id = $1 order by position`,
      [productId],
    )
    return rows
  })
}

// Deletes one photo of the piece and moves the later ones up (no gaps). Returns its url, or null when the
// piece has no such photo.
export async function deleteProductImage(productId: number, imageId: number): Promise<string | null> {
  return withTransaction(async (client) => {
    if (!(await lockProduct(client, productId))) return null
    const { rows } = await client.query<{ url: string; position: number }>(
      "delete from product_images where id = $1 and product_id = $2 returning url, position",
      [imageId, productId],
    )
    if (rows.length === 0) return null
    await client.query("update product_images set position = position - 1 where product_id = $1 and position > $2", [
      productId,
      rows[0].position,
    ])
    return rows[0].url
  })
}
