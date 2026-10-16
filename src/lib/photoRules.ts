// The studio's photo limits and the exact words Omar sees when one is broken. The studio shows the messages as they are.
export const MAX_PHOTOS = 30
// Agreed with Rami 2026-10-15: narrower photos would look soft on large screens.
export const MIN_PHOTO_WIDTH = 1440
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024
export const UPLOAD_EXPIRES_SECONDS = 300

export const PHOTO_MESSAGES = {
  tooSmall: "This photo is too small for the website (at least 1440 px wide).",
  notPhoto: "This file isn't a JPEG, PNG or WebP photo.",
  uploadMissing: "This upload wasn't found. Upload the photo again.",
  tooLarge: "This photo is larger than 30 MB.",
  tooMany: "A piece can have at most 30 photos.",
  badOrder: "Send every photo of this piece exactly once.",
} as const
