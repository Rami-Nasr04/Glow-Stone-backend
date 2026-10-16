import { beforeEach, describe, expect, it, vi } from "vitest"
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors"
import { PHOTO_MESSAGES } from "../lib/photoRules"
import { deleteObject } from "../lib/s3"
import { presignUpload } from "../lib/s3Upload"
import { countProductImages, deleteProductImage, reorderProductImages } from "../models/productImageModel"
import { deletePhoto, reorderPhotos, requestUpload } from "./adminPhotoService"

vi.mock("../lib/s3")
vi.mock("../lib/s3Upload")
vi.mock("../models/productImageModel")

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const row = (id: number, position: number) => ({
  id,
  product_id: 5,
  url: `https://cdn.test/products/5/${`p${id}`.padEnd(12, "a")}`,
  width: 2880,
  height: 1920,
  position,
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("IMAGES_BUCKET", "bucket-test")
  vi.stubEnv("CDN_URL", "https://cdn.test")
})

describe("requestUpload()", () => {
  it("gives a 5-minute upload into this piece's incoming folder, named by a fresh uuid", async () => {
    vi.mocked(countProductImages).mockResolvedValue(29)
    vi.mocked(presignUpload).mockResolvedValue({ url: "https://bucket-test.s3/", fields: { key: "k" } })
    const slot = await requestUpload(5)
    expect(slot.uploadId).toMatch(UUID)
    expect(presignUpload).toHaveBeenCalledExactlyOnceWith("bucket-test", `incoming/5/${slot.uploadId}`)
    expect(slot).toEqual({ uploadId: slot.uploadId, url: "https://bucket-test.s3/", fields: { key: "k" } })
  })

  it("gives a different uuid every time", async () => {
    vi.mocked(countProductImages).mockResolvedValue(0)
    vi.mocked(presignUpload).mockResolvedValue({ url: "u", fields: {} })
    const [a, b] = await Promise.all([requestUpload(5), requestUpload(5)])
    expect(a.uploadId).not.toBe(b.uploadId)
  })

  it("is not found for an unknown piece", async () => {
    vi.mocked(countProductImages).mockResolvedValue(null)
    await expect(requestUpload(99)).rejects.toThrow(new NotFoundError("Product not found"))
    expect(presignUpload).not.toHaveBeenCalled()
  })

  it("refuses when the piece already has 30 photos", async () => {
    vi.mocked(countProductImages).mockResolvedValue(30)
    await expect(requestUpload(5)).rejects.toThrow(new ConflictError(PHOTO_MESSAGES.tooMany))
    expect(presignUpload).not.toHaveBeenCalled()
  })
})

describe("reorderPhotos()", () => {
  it("returns the photos in their new order, as the studio sees them", async () => {
    vi.mocked(reorderProductImages).mockResolvedValue([row(3, 1), row(1, 2)])
    expect(await reorderPhotos(5, [3, 1])).toStrictEqual([
      { id: 3, url: row(3, 1).url, width: 2880, height: 1920, position: 1 },
      { id: 1, url: row(1, 2).url, width: 2880, height: 1920, position: 2 },
    ])
    expect(reorderProductImages).toHaveBeenCalledExactlyOnceWith(5, [3, 1])
  })

  it("is not found for an unknown piece", async () => {
    vi.mocked(reorderProductImages).mockResolvedValue(null)
    await expect(reorderPhotos(99, [1])).rejects.toThrow(new NotFoundError("Product not found"))
  })

  it("passes the wrong-list refusal through", async () => {
    vi.mocked(reorderProductImages).mockRejectedValue(new ValidationError(PHOTO_MESSAGES.badOrder))
    await expect(reorderPhotos(5, [1])).rejects.toThrow(PHOTO_MESSAGES.badOrder)
  })
})

describe("deletePhoto()", () => {
  it("deletes the row first, then the master file it pointed to", async () => {
    vi.mocked(deleteProductImage).mockResolvedValue("https://cdn.test/products/5/abcdefghij12")
    await deletePhoto(5, 7)
    expect(deleteProductImage).toHaveBeenCalledExactlyOnceWith(5, 7)
    expect(deleteObject).toHaveBeenCalledExactlyOnceWith("bucket-test", "products/5/abcdefghij12.webp")
    expect(vi.mocked(deleteProductImage).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deleteObject).mock.invocationCallOrder[0],
    )
  })

  it("is not found when the piece has no such photo, and deletes no file", async () => {
    vi.mocked(deleteProductImage).mockResolvedValue(null)
    await expect(deletePhoto(5, 7)).rejects.toThrow(new NotFoundError("Photo not found"))
    expect(deleteObject).not.toHaveBeenCalled()
  })

  it("still succeeds when the file delete fails (the photo is already gone from the piece)", async () => {
    vi.mocked(deleteProductImage).mockResolvedValue("https://cdn.test/products/5/abcdefghij12")
    vi.mocked(deleteObject).mockRejectedValue(new Error("S3 down"))
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(deletePhoto(5, 7)).resolves.toBeUndefined()
    expect(log).toHaveBeenCalled()
  })

  it("never deletes a file outside the piece's photos, whatever the stored url says", async () => {
    vi.mocked(deleteProductImage).mockResolvedValue("https://cdn.test/../site/index")
    vi.spyOn(console, "error").mockImplementation(() => {})
    await deletePhoto(5, 7)
    expect(deleteObject).not.toHaveBeenCalled()
  })
})
