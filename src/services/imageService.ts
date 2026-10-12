import sharp from "sharp"

const WEBP_QUALITY = 80

// One master photo at one allowed width: upright, never enlarged, WebP, no metadata (sharp drops it unless asked).
export async function resizeImage(master: Uint8Array, width: number): Promise<Buffer> {
  return sharp(master).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer()
}
