import { randomInt } from "node:crypto"

// Where photos live in the images bucket. The CDN serves products/* only; incoming/* is the upload drop
// (cleared by the bucket's 1-day rule) and is never public.

// The original the studio uploaded, before the server turns it into a master.
export const incomingKey = (productId: number, uploadId: string) => `incoming/${productId}/${uploadId}`

const NAME_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"

// 12 random a-z0-9: a new name for every master, so the CDN's year-long cache never shows an old photo.
export const newMasterName = () => Array.from({ length: 12 }, () => NAME_ALPHABET[randomInt(NAME_ALPHABET.length)]).join("")

export const masterKey = (productId: number, name: string) => `products/${productId}/${name}.webp`

// The database url (<CDN>/products/<id>/<name>) without its extension; the website adds /<width>.webp.
export const masterUrl = (cdnUrl: string, productId: number, name: string) => `${cdnUrl}/products/${productId}/${name}`

const MASTER_PATH = /^\/(products\/[1-9]\d{0,9}\/[a-z0-9]{12})$/

// A stored url back to its master's key; null for anything that isn't a master's url.
export function masterKeyFromUrl(url: string): string | null {
  const match = MASTER_PATH.exec(URL.canParse(url) ? new URL(url).pathname : "")
  return match ? `${match[1]}.webp` : null
}
