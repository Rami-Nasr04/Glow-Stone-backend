import sharp from "sharp"
import { describe, expect, it } from "vitest"
import { resizeImage } from "./imageService"

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
