import { z } from "zod"

// Product ids are Postgres `integer` identity values: 1 to 2,147,483,647, written plainly (no "03", "1e2", spaces).
const MAX_PRODUCT_ID = 2_147_483_647
const INVALID_ID = "Invalid product id"

export const productIdSchema = z
  .string()
  .regex(/^[1-9]\d{0,9}$/, INVALID_ID)
  .transform(Number)
  .pipe(z.number().max(MAX_PRODUCT_ID, INVALID_ID))

// The limits below mirror the `products` columns (002_products.sql), so a bad value gets a clear message
// here instead of a database error: integer, numeric(10,2) for the price, numeric(6,1) for sizes and weight.
const MAX_INTEGER = 2_147_483_647
const MAX_PRICE = 99_999_999.99
const MAX_MEASURE = 99_999.9

// Floats can't hold most decimals exactly (0.07 * 100 = 7.000000000000001), so compare with a small tolerance.
const hasAtMostDecimals = (value: number, places: number) => {
  const scaled = value * 10 ** places
  return Math.abs(scaled - Math.round(scaled)) < 1e-6
}

const typeError = (field: string, kind: string) => ({
  error: (issue: { input: unknown }) => (issue.input === undefined ? `${field} is required` : `${field} must be ${kind}`),
})

const text = (field: string) => z.string(typeError(field, "text")).trim().min(1, `${field} can't be blank`)

// A blank summary or story means "none".
const optionalText = (field: string) =>
  z
    .string(typeError(field, "text"))
    .trim()
    .transform((v) => v || null)
    .nullable()

const wholeNumber = (field: string) =>
  z.number(typeError(field, "a number")).int(`${field} must be a whole number`).max(MAX_INTEGER, `${field} is too large`)

const positiveWholeNumber = (field: string) => wholeNumber(field).positive(`${field} must be more than 0`)

const measure = (field: string) =>
  z
    .number(typeError(field, "a number"))
    .positive(`${field} must be more than 0`)
    .max(MAX_MEASURE, `${field} is too large`)
    .refine((v) => hasAtMostDecimals(v, 1), `${field} can have at most 1 decimal`)
    .nullable()

const fields = {
  name: text("name"),
  stoneType: text("stoneType"),
  color: text("color"),
  price: z
    .number(typeError("price", "a number"))
    .positive("price must be more than 0")
    .max(MAX_PRICE, "price is too large")
    .refine((v) => hasAtMostDecimals(v, 2), "price can have at most 2 decimals"),
  bottles: positiveWholeNumber("bottles"),
  heightCm: measure("heightCm"),
  widthCm: measure("widthCm"),
  depthCm: measure("depthCm"),
  weightKg: measure("weightKg"),
  editionSize: positiveWholeNumber("editionSize"),
  remaining: wholeNumber("remaining").min(0, "remaining can't be negative"),
  status: z.enum(["draft", "published"], "status must be draft or published"),
  featured: z.boolean("featured must be true or false"),
  summary: optionalText("summary"),
  story: optionalText("story"),
}

const REMAINING_ABOVE_EDITION = "remaining can't be more than editionSize"
const remainingWithinEdition = (p: { remaining?: number; editionSize?: number }) =>
  p.remaining === undefined || p.editionSize === undefined || p.remaining <= p.editionSize

// POST /admin/products. Fields left out take the database defaults (status draft, featured false, the rest null).
export const productInputSchema = z
  .strictObject({
    ...fields,
    heightCm: fields.heightCm.optional(),
    widthCm: fields.widthCm.optional(),
    depthCm: fields.depthCm.optional(),
    weightKg: fields.weightKg.optional(),
    status: fields.status.optional(),
    featured: fields.featured.optional(),
    summary: fields.summary.optional(),
    story: fields.story.optional(),
  })
  .refine(remainingWithinEdition, { message: REMAINING_ABOVE_EDITION, path: ["remaining"] })

// PATCH /admin/products/{id}: only the fields sent change. When only one of remaining / editionSize is sent,
// the database rule `remaining_within_edition` checks it against the saved value.
export const productPatchSchema = z
  .strictObject(fields)
  .partial()
  .refine((p) => Object.keys(p).length > 0, "Send at least one field to change")
  .refine(remainingWithinEdition, { message: REMAINING_ABOVE_EDITION, path: ["remaining"] })

export type ProductInput = z.infer<typeof productInputSchema>
export type ProductPatch = z.infer<typeof productPatchSchema>
