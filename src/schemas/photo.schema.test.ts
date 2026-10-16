import { describe, expect, it } from "vitest"
import { PHOTO_MESSAGES } from "../lib/photoRules"
import { imageIdSchema, photoOrderSchema, uploadBodySchema } from "./photo.schema"

const message = (result: { success: boolean; error?: { issues: { message: string }[] } }) => result.error?.issues[0]?.message

describe("uploadBodySchema", () => {
  it("accepts an upload id (a uuid)", () => {
    const uploadId = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b"
    expect(uploadBodySchema.parse({ uploadId })).toEqual({ uploadId })
  })

  it.each([[{}], [{ uploadId: "abc" }], [{ uploadId: " 3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b" }], [{ uploadId: 5 }]])(
    "says the upload wasn't found for %j",
    (body) => {
      expect(message(uploadBodySchema.safeParse(body))).toBe(PHOTO_MESSAGES.uploadMissing)
    },
  )

  it("refuses unknown fields", () => {
    const result = uploadBodySchema.safeParse({ uploadId: "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b", key: "products/1/x" })
    expect(message(result)).toContain("Unrecognized key")
  })
})

describe("photoOrderSchema", () => {
  it("accepts a list of photo ids", () => {
    expect(photoOrderSchema.parse({ imageIds: [3, 1, 2] })).toEqual({ imageIds: [3, 1, 2] })
  })

  it.each([[{}], [{ imageIds: [] }], [{ imageIds: [1, 1.5] }], [{ imageIds: ["1"] }], [{ imageIds: [0] }], [{ imageIds: Array.from({ length: 31 }, (_, i) => i + 1) }]])(
    "asks for every photo once for %j",
    (body) => {
      expect(message(photoOrderSchema.safeParse(body))).toBe(PHOTO_MESSAGES.badOrder)
    },
  )
})

describe("imageIdSchema", () => {
  it("reads a plain id from the path", () => {
    expect(imageIdSchema.parse("42")).toBe(42)
  })

  it.each(["03", "0", "1e2", "abc", "", "2147483648"])("refuses %j", (id) => {
    expect(message(imageIdSchema.safeParse(id))).toBe("Invalid photo id")
  })
})
