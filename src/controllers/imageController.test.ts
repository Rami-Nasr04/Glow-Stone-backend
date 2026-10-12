import type { LambdaFunctionURLEvent } from "aws-lambda"
import sharp from "sharp"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { readObject } from "../lib/s3"
import { resize } from "./imageController"

vi.mock("../lib/s3")

const PHOTO = "/products/3/k7f2q9ab12cd"
const event = (rawPath: string) => ({ rawPath }) as unknown as LambdaFunctionURLEvent

beforeEach(() => {
  vi.resetAllMocks()
  process.env.IMAGES_BUCKET = "test-bucket"
})

describe("resize()", () => {
  it("returns the photo at that width as WebP, cached for a year", async () => {
    const master = await sharp({ create: { width: 2000, height: 3000, channels: 3, background: "#fff" } }).webp().toBuffer()
    vi.mocked(readObject).mockResolvedValue(master)
    const res = await resize(event(`${PHOTO}/480.webp`))
    expect(readObject).toHaveBeenCalledWith("test-bucket", "products/3/k7f2q9ab12cd.webp")
    expect(res).toMatchObject({
      statusCode: 200,
      isBase64Encoded: true,
      headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
    })
    const meta = await sharp(Buffer.from(String(res.body), "base64")).metadata()
    expect(meta).toMatchObject({ format: "webp", width: 480, height: 720 })
  })

  it("refuses a bad width or path without reading S3", async () => {
    const bad = [
      event(`${PHOTO}.webp`),
      event(`${PHOTO}/961.webp`),
      event(`${PHOTO}/0960.webp`),
      event(`${PHOTO}/960.jpg`),
      event("/products/1/../k7f2q9ab12cd/480.webp"),
    ]
    for (const e of bad) {
      expect(await resize(e)).toMatchObject({ statusCode: 400, headers: { "Cache-Control": "public, max-age=60" } })
    }
    expect(readObject).not.toHaveBeenCalled()
  })

  it("answers 404 for a photo that doesn't exist, cached briefly", async () => {
    vi.mocked(readObject).mockResolvedValue(null)
    expect(await resize(event(`${PHOTO}/960.webp`))).toMatchObject({
      statusCode: 404,
      headers: { "Cache-Control": "public, max-age=60" },
    })
  })

  it("answers 500 without details when S3 fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(readObject).mockRejectedValue(new Error("AccessDenied for test-bucket"))
    const res = await resize(event(`${PHOTO}/960.webp`))
    expect(res.statusCode).toBe(500)
    expect(res.body).not.toContain("test-bucket")
  })
})
