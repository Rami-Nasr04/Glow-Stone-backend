import sharp from "sharp"
import { ValidationError } from "../lib/errors"
import { MIN_PHOTO_WIDTH, PHOTO_MESSAGES } from "../lib/photoRules"

const WEBP_QUALITY = 80

// One master photo at one allowed width: upright, never enlarged, WebP, no metadata (sharp drops it unless asked).
export async function resizeImage(master: Uint8Array, width: number): Promise<Buffer> {
  return sharp(master).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer()
}

// The master the CDN resizes from. Same settings as the first 71 photos.
const MASTER_WIDTH = 2880
const MASTER_QUALITY = 90
// Judged from the bytes, never from the file's name or the type the browser claimed.
const PHOTO_FORMATS = new Set(["jpeg", "png", "webp"])

export interface Master {
  data: Buffer
  width: number
  height: number
}

// A camera or phone photo → upright, at most 2880 wide, WebP, with camera and location data dropped.
export async function makeMaster(original: Uint8Array): Promise<Master> {
  const meta = await sharp(original)
    .metadata()
    .catch(() => null)
  if (!meta || !PHOTO_FORMATS.has(meta.format ?? "")) throw new ValidationError(PHOTO_MESSAGES.notPhoto)
  // autoOrient = the size once the EXIF orientation is applied (a portrait phone photo is stored sideways).
  if (meta.autoOrient.width < MIN_PHOTO_WIDTH) throw new ValidationError(PHOTO_MESSAGES.tooSmall)
  // A file can have a valid header and still be cut off or damaged: sharp then fails while decoding it.
  const { data, info } = await sharp(original)
    .rotate()
    .resize({ width: MASTER_WIDTH, withoutEnlargement: true })
    .webp({ quality: MASTER_QUALITY })
    .toBuffer({ resolveWithObject: true })
    .catch((err: unknown) => {
      console.error("Photo could not be decoded:", err)
      throw new ValidationError(PHOTO_MESSAGES.notPhoto)
    })
  return { data, width: info.width, height: info.height }
}
