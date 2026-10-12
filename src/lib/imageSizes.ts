// The only widths the image CDN serves; the frontend asks for these in its srcset.
export const IMAGE_WIDTHS: readonly number[] = [480, 960, 1440, 2048, 2880]

// A sized photo: /products/<product id>/<12 random a-z0-9>/<width>.webp. The width sits in the path, so it is
// part of CloudFront's cache key (the managed CachingOptimized policy ignores query strings).
// Every upload gets a new random name, so cached copies never go stale.
// src/edge/imageGuard.js repeats this rule (CloudFront Functions can't import); a test keeps them equal.
export const IMAGE_PATH = /^\/products\/([1-9]\d{0,9})\/([a-z0-9]{12})\/(480|960|1440|2048|2880)\.webp$/
