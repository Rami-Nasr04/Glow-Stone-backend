import { describe, expect, it } from "vitest"
import { productIdSchema } from "./product.schema"

describe("productIdSchema", () => {
  it("accepts a positive whole number and returns it as a number", () => {
    expect(productIdSchema.parse("3")).toBe(3)
    expect(productIdSchema.parse("2147483647")).toBe(2147483647)
  })

  it.each(["abc", "0", "-1", "1.5", "03", " 3", "1e2", "", "2147483648"])("rejects %j", (raw) => {
    expect(productIdSchema.safeParse(raw).success).toBe(false)
  })

  it("explains the problem plainly", () => {
    const result = productIdSchema.safeParse("abc")
    expect(result.success ? "" : result.error.issues[0].message).toBe("Invalid product id")
  })
})
