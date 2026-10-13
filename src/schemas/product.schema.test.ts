import { describe, expect, it } from "vitest"
import { productIdSchema, productInputSchema, productPatchSchema } from "./product.schema"

describe("productIdSchema", () => {
  it.each(["1", "42", "2147483647"])("accepts %s", (id) => {
    expect(productIdSchema.parse(id)).toBe(Number(id))
  })

  it.each(["0", "03", "-1", "1.5", "1e2", " 1", "abc", "", "2147483648"])("refuses %j", (id) => {
    expect(productIdSchema.safeParse(id).success).toBe(false)
  })
})

const valid = {
  name: "Sannine · Sand",
  stoneType: "Limestone",
  color: "Warm beige",
  price: 1120.5,
  bottles: 6,
  editionSize: 10,
  remaining: 10,
}

const firstMessage = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message

describe("productInputSchema (create)", () => {
  it("accepts the required fields alone, leaving the rest to the database defaults", () => {
    expect(productInputSchema.parse(valid)).toEqual(valid)
  })

  it("accepts every optional field", () => {
    const full = {
      ...valid,
      heightCm: 72.5,
      widthCm: null,
      depthCm: 20,
      weightKg: 31.4,
      status: "published",
      featured: true,
      summary: "One line.",
      story: "One.\n\nTwo.",
    }
    expect(productInputSchema.parse(full)).toEqual(full)
  })

  it("trims text, and turns a blank summary or story into null", () => {
    const parsed = productInputSchema.parse({ ...valid, name: "  Arz  ", summary: "   ", story: "" })
    expect(parsed).toMatchObject({ name: "Arz", summary: null, story: null })
  })

  it.each([
    ["name", { name: undefined }, "name is required"],
    ["a blank name", { name: "   " }, "name can't be blank"],
    ["a blank stone type", { stoneType: "" }, "stoneType can't be blank"],
    ["a number as color", { color: 3 }, "color must be text"],
    ["a price of 0", { price: 0 }, "price must be more than 0"],
    ["a price with 3 decimals", { price: 10.005 }, "price can have at most 2 decimals"],
    ["a price too large for the database", { price: 100_000_000 }, "price is too large"],
    ["a price as text", { price: "420" }, "price must be a number"],
    ["half a bottle", { bottles: 2.5 }, "bottles must be a whole number"],
    ["0 bottles", { bottles: 0 }, "bottles must be more than 0"],
    ["an edition of 0", { editionSize: 0 }, "editionSize must be more than 0"],
    ["a negative remaining", { remaining: -1 }, "remaining can't be negative"],
    ["remaining above the edition", { remaining: 11 }, "remaining can't be more than editionSize"],
    ["a height of 0", { heightCm: 0 }, "heightCm must be more than 0"],
    ["a width with 2 decimals", { widthCm: 30.25 }, "widthCm can have at most 1 decimal"],
    ["a weight too large for the database", { weightKg: 100_000 }, "weightKg is too large"],
    ["an unknown status", { status: "sold" }, "status must be draft or published"],
    ["featured as text", { featured: "yes" }, "featured must be true or false"],
    ["a typo in a field name", { prise: 420 }, 'Unrecognized key: "prise"'],
  ])("refuses %s", (_label, change, message) => {
    expect(firstMessage(productInputSchema.safeParse({ ...valid, ...change }))).toBe(message)
  })

  it("accepts decimals that floats can't hold exactly", () => {
    expect(productInputSchema.safeParse({ ...valid, price: 0.07, weightKg: 0.3 }).success).toBe(true)
    expect(productInputSchema.safeParse({ ...valid, price: 19.99, heightCm: 118.7 }).success).toBe(true)
  })

  it("accepts remaining 0 (sold out) and remaining equal to the edition", () => {
    expect(productInputSchema.safeParse({ ...valid, remaining: 0 }).success).toBe(true)
    expect(productInputSchema.safeParse({ ...valid, remaining: 10 }).success).toBe(true)
  })
})

describe("productPatchSchema (update)", () => {
  it("accepts a single field", () => {
    expect(productPatchSchema.parse({ status: "draft" })).toEqual({ status: "draft" })
  })

  it("accepts null to clear an optional field", () => {
    expect(productPatchSchema.parse({ heightCm: null, summary: null })).toEqual({ heightCm: null, summary: null })
  })

  it("refuses an empty change", () => {
    expect(firstMessage(productPatchSchema.safeParse({}))).toBe("Send at least one field to change")
  })

  it("refuses null for a required field", () => {
    expect(firstMessage(productPatchSchema.safeParse({ name: null }))).toBe("name must be text")
  })

  it("refuses remaining above the edition when both are sent", () => {
    expect(firstMessage(productPatchSchema.safeParse({ editionSize: 5, remaining: 6 }))).toBe(
      "remaining can't be more than editionSize",
    )
  })

  it("applies the same field rules as create", () => {
    expect(firstMessage(productPatchSchema.safeParse({ price: -1 }))).toBe("price must be more than 0")
    expect(firstMessage(productPatchSchema.safeParse({ name: " " }))).toBe("name can't be blank")
    expect(firstMessage(productPatchSchema.safeParse({ prise: 1 }))).toBe('Unrecognized key: "prise"')
  })
})
