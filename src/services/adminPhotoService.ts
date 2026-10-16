import { randomUUID } from "node:crypto"
import { requiredEnv } from "../lib/env"
import { ConflictError, NotFoundError } from "../lib/errors"
import { incomingKey, masterKeyFromUrl } from "../lib/photoKeys"
import { MAX_PHOTOS, PHOTO_MESSAGES } from "../lib/photoRules"
import { deleteObject, presignUpload, type PresignedUpload } from "../lib/s3"
import { countProductImages, deleteProductImage, reorderProductImages } from "../models/productImageModel"
import type { AdminProductImage } from "../types/catalog"
import { toAdminImage } from "./adminProductService"

// Never imports sharp: these run without the sharp layer (only photoUploadService needs it).

export interface UploadSlot extends PresignedUpload {
  uploadId: string
}

// Permission to upload one photo of this piece straight to S3 (step 1 of 3; the confirm is photoUploadService).
// The 30-photo rule is checked here so Omar learns early, and again when the photo is added.
export async function requestUpload(productId: number): Promise<UploadSlot> {
  const count = await countProductImages(productId)
  if (count === null) throw new NotFoundError("Product not found")
  if (count >= MAX_PHOTOS) throw new ConflictError(PHOTO_MESSAGES.tooMany)
  const uploadId = randomUUID()
  return { uploadId, ...(await presignUpload(requiredEnv("IMAGES_BUCKET"), incomingKey(productId, uploadId))) }
}

export async function reorderPhotos(productId: number, imageIds: number[]): Promise<AdminProductImage[]> {
  const rows = await reorderProductImages(productId, imageIds)
  if (!rows) throw new NotFoundError("Product not found")
  return rows.map(toAdminImage)
}

// The row goes first (that is what the website reads); the file after. A failed file delete only leaves an
// unused file behind, so it is logged, not returned.
export async function deletePhoto(productId: number, imageId: number): Promise<void> {
  const url = await deleteProductImage(productId, imageId)
  if (!url) throw new NotFoundError("Photo not found")
  const key = masterKeyFromUrl(url)
  if (!key) {
    console.error("Deleted photo had an unexpected url; its file was left:", url)
    return
  }
  try {
    await deleteObject(requiredEnv("IMAGES_BUCKET"), key)
  } catch (err) {
    console.error("Photo file delete failed:", key, err)
  }
}
