import sharp from "sharp"
import { describe, expect, it } from "vitest"
import { ValidationError } from "../lib/errors"
import { PHOTO_MESSAGES } from "../lib/photoRules"
import { makeMaster, resizeImage } from "./imageService"

const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#b9a58c" } }).jpeg().toBuffer()

describe("resizeImage()", () => {
  it("shrinks to the width, keeps the shape, outputs WebP", async () => {
    const out = await sharp(await resizeImage(await photo(3000, 2000), 960)).metadata()
    expect(out).toMatchObject({ format: "webp", width: 960, height: 640 })
  })

  it("never enlarges a smaller master", async () => {
    const out = await sharp(await resizeImage(await photo(2048, 3072), 2880)).metadata()
    expect(out).toMatchObject({ width: 2048, height: 3072 })
  })

  it("turns a sideways photo upright and drops its metadata", async () => {
    const sideways = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#000" } })
      .withMetadata({ orientation: 6 })
      .withExif({ IFD0: { Copyright: "GPS and camera data" } })
      .jpeg()
      .toBuffer()
    const out = await sharp(await resizeImage(sideways, 480)).metadata()
    expect(out).toMatchObject({ width: 200, height: 300 })
    expect(out.exif).toBeUndefined()
    expect(out.orientation).toBeUndefined()
  })
})

const image = (width: number, height: number, format: "jpeg" | "png" | "webp" | "gif", orientation?: number) => {
  const base = sharp({ create: { width, height, channels: 3, background: "#b9a58c" } })
  return (orientation ? base.withMetadata({ orientation }) : base).toFormat(format).toBuffer()
}

describe("makeMaster()", () => {
  it("turns an iPhone-style sideways JPEG upright, with width and height swapped", async () => {
    // Stored 2000×1600 with EXIF orientation 6, like a portrait phone photo: upright it is 1600×2000.
    const master = await makeMaster(await image(2000, 1600, "jpeg", 6))
    expect(master).toMatchObject({ width: 1600, height: 2000 })
    expect(await sharp(master.data).metadata()).toMatchObject({ format: "webp", width: 1600, height: 2000 })
  })

  it("shrinks a large PNG to 2880 wide, keeping its shape", async () => {
    const master = await makeMaster(await image(3000, 2000, "png"))
    expect(master).toMatchObject({ width: 2880, height: 1920 })
  })

  it("never enlarges a smaller WebP", async () => {
    expect(await makeMaster(await image(1500, 1000, "webp"))).toMatchObject({ width: 1500, height: 1000 })
  })

  it("accepts exactly 1067 px wide, the width of the studio's own edited portraits", async () => {
    expect(await makeMaster(await image(1067, 1600, "jpeg"))).toMatchObject({ width: 1067, height: 1600 })
  })

  it("refuses a photo narrower than 1067 px", async () => {
    await expect(makeMaster(await image(1066, 1600, "jpeg"))).rejects.toThrow(new ValidationError(PHOTO_MESSAGES.tooSmall))
  })

  it("judges the width once upright: wide when stored, narrow when turned", async () => {
    await expect(makeMaster(await image(1800, 1000, "jpeg", 6))).rejects.toThrow(PHOTO_MESSAGES.tooSmall)
  })

  it("refuses a file that isn't a photo, whatever its name", async () => {
    await expect(makeMaster(Buffer.from("not a photo, just text named .jpg"))).rejects.toThrow(
      new ValidationError(PHOTO_MESSAGES.notPhoto),
    )
  })

  it("refuses a broken photo (cut off mid-upload) as not a photo, not as a server error", async () => {
    const whole = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: "#000", noise: { type: "gaussian", mean: 128, sigma: 40 } } })
      .jpeg()
      .toBuffer()
    await expect(makeMaster(whole.subarray(0, Math.floor(whole.length / 2)))).rejects.toThrow(
      new ValidationError(PHOTO_MESSAGES.notPhoto),
    )
  })

  it("refuses other image formats", async () => {
    await expect(makeMaster(await image(2000, 1500, "gif"))).rejects.toThrow(PHOTO_MESSAGES.notPhoto)
  })

  it("drops camera and location data", async () => {
    const withData = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: "#000" } })
      .withMetadata({ orientation: 1 })
      .withExif({ IFD0: { Copyright: "camera data" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "33/1 53/1 0/1" } })
      .jpeg()
      .toBuffer()
    expect((await sharp(withData).metadata()).exif).toBeDefined()
    const out = await sharp((await makeMaster(withData)).data).metadata()
    expect(out.exif).toBeUndefined()
    expect(out.orientation).toBeUndefined()
  })
})
