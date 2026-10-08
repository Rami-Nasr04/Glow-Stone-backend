import { z } from "zod"

// Product ids are Postgres `integer` identity values: 1 to 2,147,483,647, written plainly (no "03", "1e2", spaces).
const MAX_PRODUCT_ID = 2_147_483_647
const INVALID_ID = "Invalid product id"

export const productIdSchema = z
  .string()
  .regex(/^[1-9]\d{0,9}$/, INVALID_ID)
  .transform(Number)
  .pipe(z.number().max(MAX_PRODUCT_ID, INVALID_ID))
