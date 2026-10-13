import { executeQuery } from "../lib/db"

export interface ProductImageRow {
  product_id: number
  url: string
  width: number
  height: number
}

// Photos of several pieces in one query (never one query per piece), each piece's in position order.
// perProduct keeps only each piece's first N photos (the list shows cover + hover); null = all.
export async function findProductImages(productIds: number[], perProduct: number | null = null): Promise<ProductImageRow[]> {
  if (productIds.length === 0) return []
  return executeQuery<ProductImageRow>(
    `select product_id, url, width, height
     from (
       select product_id, url, width, height, position,
              row_number() over (partition by product_id order by position) as rank
       from product_images
       where product_id = any($1::int[])
     ) ranked
     where $2::int is null or rank <= $2::int
     order by product_id, position`,
    [productIds, perProduct],
  )
}
