import { describe, expect, it } from "vitest"
import { advanceOrderSchema, CUSTOMER_ID, deliveryFeeSchema, orderStatusFilterSchema } from "./adminOrder.schema"

describe("orderStatusFilterSchema", () => {
  it("accepts the five statuses or nothing", () => {
    expect(orderStatusFilterSchema.parse("pending")).toBe("pending")
    expect(orderStatusFilterSchema.parse(undefined)).toBeUndefined()
  })

  it("refuses anything else", () => {
    expect(orderStatusFilterSchema.safeParse("lost").error?.issues[0]?.message).toBe("Unknown order status.")
  })
})

describe("advanceOrderSchema", () => {
  it.each(["confirmed", "out_for_delivery", "delivered"])("accepts %s", (status) => {
    expect(advanceOrderSchema.parse({ status })).toEqual({ status })
  })

  it.each(["pending", "cancelled", "shipped"])("refuses %s", (status) => {
    expect(advanceOrderSchema.safeParse({ status }).success).toBe(false)
  })

  it("refuses other keys", () => {
    expect(advanceOrderSchema.safeParse({ status: "confirmed", deliveryFee: 5 }).success).toBe(false)
  })
})

describe("deliveryFeeSchema", () => {
  it.each([0, 15, 12.5, 7.25, 10_000])("accepts %s", (deliveryFee) => {
    expect(deliveryFeeSchema.parse({ deliveryFee })).toEqual({ deliveryFee })
  })

  it.each([-1, 10_000.01, 1.005, "15", null])("refuses %s", (deliveryFee) => {
    expect(deliveryFeeSchema.safeParse({ deliveryFee }).success).toBe(false)
  })
})

describe("CUSTOMER_ID", () => {
  it("matches a Cognito sub only", () => {
    expect(CUSTOMER_ID.test("1b5c2a4e-8f0d-4c3b-9a71-2e6d5f8a9b10")).toBe(true)
    expect(CUSTOMER_ID.test("1b5c2a4e")).toBe(false)
  })
})
