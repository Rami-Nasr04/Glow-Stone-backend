import { z } from "zod"
import { MAX_PHOTOS, PHOTO_MESSAGES } from "../lib/photoRules"
import { pathIdSchema } from "./product.schema"

export const imageIdSchema = pathIdSchema("Invalid photo id")

// POST /admin/products/{id}/photos. Only the uuid travels: the server rebuilds the S3 key from the piece's id,
// so an upload can never be confirmed for another piece. Missing or malformed reads as "not found".
export const uploadBodySchema = z.strictObject({
  uploadId: z.uuid({ error: PHOTO_MESSAGES.uploadMissing }),
})

// PUT /admin/products/{id}/photos/order. Whether the ids are exactly this piece's photos is checked in the database.
const badOrder = { error: PHOTO_MESSAGES.badOrder }
export const photoOrderSchema = z.strictObject({
  imageIds: z
    .array(z.number(badOrder).int(badOrder).positive(badOrder), badOrder)
    .min(1, badOrder)
    .max(MAX_PHOTOS, badOrder),
})
