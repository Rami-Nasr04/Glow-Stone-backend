import { requiredEnv } from "../lib/env"
import { NotFoundError, ValidationError } from "../lib/errors"
import { incomingKey, masterKey, masterUrl, newMasterName } from "../lib/photoKeys"
import { MAX_UPLOAD_BYTES, PHOTO_MESSAGES } from "../lib/photoRules"
import { deleteObject, objectSize, readObject, writeObject } from "../lib/s3"
import { addProductImage } from "../models/productImageModel"
import type { AdminProductImage } from "../types/catalog"
import { toAdminImage } from "./adminProductService"
import { makeMaster } from "./imageService"

// Loads sharp (through imageService), so only the function with the sharp layer may import this file.

async function deleteQuietly(bucket: string, key: string, what: string): Promise<void> {
  try {
    await deleteObject(bucket, key)
  } catch (err) {
    console.error(`Could not delete the ${what}:`, key, err)
  }
}

// Step 3 of 3: the photo the studio uploaded to incoming/ becomes a master and is added at the end of the piece.
export async function confirmUpload(productId: number, uploadId: string): Promise<AdminProductImage> {
  const bucket = requiredEnv("IMAGES_BUCKET")
  const cdnUrl = requiredEnv("CDN_URL")
  const original = incomingKey(productId, uploadId)

  // S3 already refused anything over 30 MB at upload; this checks again before reading it into memory.
  const size = await objectSize(bucket, original)
  if (size === null) throw new ValidationError(PHOTO_MESSAGES.uploadMissing)
  if (size > MAX_UPLOAD_BYTES) throw new ValidationError(PHOTO_MESSAGES.tooLarge)
  const bytes = await readObject(bucket, original)
  if (!bytes) throw new ValidationError(PHOTO_MESSAGES.uploadMissing)

  const master = await makeMaster(bytes)
  const name = newMasterName()
  const key = masterKey(productId, name)
  await writeObject(bucket, key, master.data, "image/webp")

  // If the row can't be added, the master would be an orphan: delete it, then answer with the reason.
  const photo = { url: masterUrl(cdnUrl, productId, name), width: master.width, height: master.height }
  const row = await addProductImage(productId, photo).catch(async (err: unknown) => {
    await deleteQuietly(bucket, key, "unused master")
    throw err
  })
  if (!row) {
    await deleteQuietly(bucket, key, "unused master")
    throw new NotFoundError("Product not found")
  }

  // The photo is added; a leftover original is removed by the bucket's 1-day rule anyway.
  await deleteQuietly(bucket, original, "uploaded original")
  return toAdminImage(row)
}
