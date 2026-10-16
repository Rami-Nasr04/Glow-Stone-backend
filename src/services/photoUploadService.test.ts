import { beforeEach, describe, expect, it, vi } from "vitest"
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors"
import { PHOTO_MESSAGES } from "../lib/photoRules"
import { deleteObject, objectSize, readObject, writeObject } from "../lib/s3"
import { addProductImage } from "../models/productImageModel"
import { makeMaster } from "./imageService"
import { confirmUpload } from "./photoUploadService"

vi.mock("../lib/s3")
vi.mock("../models/productImageModel")
vi.mock("./imageService")

const UPLOAD = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b"
const ORIGINAL = `incoming/5/${UPLOAD}`
const MASTER = /^products\/5\/([a-z0-9]{12})\.webp$/
const original = new Uint8Array([1, 2, 3])
const master = { data: Buffer.from("webp"), width: 1600, height: 2000 }

const writtenKey = () => vi.mocked(writeObject).mock.calls[0]?.[1] ?? ""

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("IMAGES_BUCKET", "bucket-test")
  vi.stubEnv("CDN_URL", "https://cdn.test")
  vi.mocked(objectSize).mockResolvedValue(3)
  vi.mocked(readObject).mockResolvedValue(original)
  vi.mocked(makeMaster).mockResolvedValue(master)
  vi.mocked(addProductImage).mockImplementation(async (product_id, photo) => ({ id: 41, product_id, ...photo, position: 4 }))
})

describe("confirmUpload()", () => {
  it("makes the master, stores it under the piece, adds it at the end and removes the original", async () => {
    const photo = await confirmUpload(5, UPLOAD)

    expect(objectSize).toHaveBeenCalledWith("bucket-test", ORIGINAL)
    expect(readObject).toHaveBeenCalledWith("bucket-test", ORIGINAL)
    expect(makeMaster).toHaveBeenCalledWith(original)
    expect(writtenKey()).toMatch(MASTER)
    expect(writeObject).toHaveBeenCalledWith("bucket-test", writtenKey(), master.data, "image/webp")
    const name = MASTER.exec(writtenKey())?.[1]
    expect(addProductImage).toHaveBeenCalledWith(5, { url: `https://cdn.test/products/5/${name}`, width: 1600, height: 2000 })
    expect(deleteObject).toHaveBeenCalledExactlyOnceWith("bucket-test", ORIGINAL)
    expect(photo).toStrictEqual({ id: 41, url: `https://cdn.test/products/5/${name}`, width: 1600, height: 2000, position: 4 })
  })

  it("names each master freshly, so a cached copy never goes stale", async () => {
    await confirmUpload(5, UPLOAD)
    await confirmUpload(5, UPLOAD)
    const [first, second] = vi.mocked(writeObject).mock.calls.map((c) => c[1])
    expect(first).not.toBe(second)
  })

  it("says the upload wasn't found when the original isn't there, and writes nothing", async () => {
    vi.mocked(objectSize).mockResolvedValue(null)
    await expect(confirmUpload(5, UPLOAD)).rejects.toThrow(new ValidationError(PHOTO_MESSAGES.uploadMissing))
    expect(readObject).not.toHaveBeenCalled()
    expect(writeObject).not.toHaveBeenCalled()
    expect(addProductImage).not.toHaveBeenCalled()
  })

  it("adds the photo once when the same upload is confirmed twice (the second finds no original)", async () => {
    await confirmUpload(5, UPLOAD)
    vi.mocked(objectSize).mockResolvedValue(null)
    await expect(confirmUpload(5, UPLOAD)).rejects.toThrow(PHOTO_MESSAGES.uploadMissing)
    expect(addProductImage).toHaveBeenCalledTimes(1)
  })

  it("refuses an original over 30 MB without reading it", async () => {
    vi.mocked(objectSize).mockResolvedValue(30 * 1024 * 1024 + 1)
    await expect(confirmUpload(5, UPLOAD)).rejects.toThrow(new ValidationError(PHOTO_MESSAGES.tooLarge))
    expect(readObject).not.toHaveBeenCalled()
  })

  it("says the upload wasn't found when the original vanishes between the two reads", async () => {
    vi.mocked(readObject).mockResolvedValue(null)
    await expect(confirmUpload(5, UPLOAD)).rejects.toThrow(PHOTO_MESSAGES.uploadMissing)
    expect(writeObject).not.toHaveBeenCalled()
  })

  it("passes the photo's own refusal through, stores nothing and removes the refused original", async () => {
    vi.mocked(makeMaster).mockRejectedValue(new ValidationError(PHOTO_MESSAGES.tooSmall))
    await expect(confirmUpload(5, UPLOAD)).rejects.toThrow(PHOTO_MESSAGES.tooSmall)
    expect(writeObject).not.toHaveBeenCalled()
    expect(addProductImage).not.toHaveBeenCalled()
    // Omar has to upload again anyway; a refused phone photo shouldn't keep its location data for a day.
    expect(deleteObject).toHaveBeenCalledExactlyOnceWith("bucket-test", ORIGINAL)
  })

  it("removes an original over 30 MB too", async () => {
    vi.mocked(objectSize).mockResolvedValue(30 * 1024 * 1024 + 1)
    await expect(confirmUpload(5, UPLOAD)).rejects.toThrow(PHOTO_MESSAGES.tooLarge)
    expect(deleteObject).toHaveBeenCalledExactlyOnceWith("bucket-test", ORIGINAL)
  })

  it("keeps the original when the failure isn't the photo's fault (so a retry can still work)", async () => {
    vi.mocked(makeMaster).mockRejectedValue(new Error("out of memory"))
    await expect(confirmUpload(5, UPLOAD)).rejects.toThrow("out of memory")
    expect(deleteObject).not.toHaveBeenCalled()
  })

  it("deletes the new master when the piece is already full, and says so", async () => {
    vi.mocked(addProductImage).mockRejectedValue(new ConflictError(PHOTO_MESSAGES.tooMany))
    await expect(confirmUpload(5, UPLOAD)).rejects.toThrow(new ConflictError(PHOTO_MESSAGES.tooMany))
    expect(deleteObject).toHaveBeenCalledExactlyOnceWith("bucket-test", writtenKey())
  })

  it("deletes the new master when the piece no longer exists", async () => {
    vi.mocked(addProductImage).mockResolvedValue(null)
    await expect(confirmUpload(5, UPLOAD)).rejects.toThrow(new NotFoundError("Product not found"))
    expect(deleteObject).toHaveBeenCalledExactlyOnceWith("bucket-test", writtenKey())
  })

  it("still returns the original error when cleaning up the master fails", async () => {
    vi.mocked(addProductImage).mockRejectedValue(new ConflictError(PHOTO_MESSAGES.tooMany))
    vi.mocked(deleteObject).mockRejectedValue(new Error("S3 down"))
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(confirmUpload(5, UPLOAD)).rejects.toThrow(ConflictError)
    expect(log).toHaveBeenCalled()
  })

  it("still adds the photo when removing the original fails (the 1-day cleanup removes it)", async () => {
    vi.mocked(deleteObject).mockRejectedValue(new Error("S3 down"))
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(confirmUpload(5, UPLOAD)).resolves.toMatchObject({ id: 41 })
    expect(log).toHaveBeenCalled()
  })
})
