// The only widths the image CDN serves; the frontend asks for these in its srcset.
// src/edge/imageGuard.js repeats both rules (CloudFront Functions can't import); a test keeps them equal.
export const IMAGE_WIDTHS: readonly number[] = [480, 960, 1440, 2048, 2880]

// /products/<product id>/<12 random a-z0-9>.webp: every upload gets a new name, so cached copies never go stale.
export const IMAGE_PATH = /^\/products\/[1-9]\d{0,9}\/[a-z0-9]{12}\.webp$/
