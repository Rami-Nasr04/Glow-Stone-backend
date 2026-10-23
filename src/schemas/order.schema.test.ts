import { describe, expect, it } from "vitest"
import { BAD_PHONE } from "./customer.schema"
import { ORDER_MESSAGES, placeOrderSchema } from "./order.schema"

const valid = {
  items: [{ productId: 5, quantity: 2, unitPrice: 890 }],
  recipient: null,
  city: "Jounieh",
  address: "Main road, Haddad bldg, 3rd floor",
  deliveryNotes: "Call before coming",
  isGift: false,
  giftMessage: null,
}

const message = (body: unknown) => {
  const result = placeOrderSchema.safeParse(body)
  return result.success ? null : result.error.issues[0]?.message
}

describe("placeOrderSchema", () => {
  it("accepts the contract's example as it is", () => {
    expect(placeOrderSchema.parse(valid)).toEqual(valid)
  })

  it("defaults recipient, notes, gift and card message when left out", () => {
    const { items, city, address } = valid
    expect(placeOrderSchema.parse({ items, city, address })).toEqual({
      items,
      city,
      address,
      recipient: null,
      deliveryNotes: null,
      isGift: false,
      giftMessage: null,
    })
  })

  it("trims texts and turns empty optional ones into null", () => {
    const parsed = placeOrderSchema.parse({ ...valid, city: " Jounieh ", deliveryNotes: "   ", giftMessage: "" })
    expect(parsed).toMatchObject({ city: "Jounieh", deliveryNotes: null, giftMessage: null })
  })

  it("accepts someone else as the recipient, trimming the name", () => {
    const parsed = placeOrderSchema.parse({ ...valid, recipient: { name: " Rita ", phone: "+9613123456" } })
    expect(parsed.recipient).toEqual({ name: "Rita", phone: "+9613123456" })
  })

  it("accepts a gift with a card message", () => {
    expect(message({ ...valid, isGift: true, giftMessage: "Happy birthday" })).toBeNull()
  })

  it.each([
    ["an empty cart", { items: [] }, ORDER_MESSAGES.emptyCart],
    ["the same piece twice", { items: [valid.items[0], { productId: 5, quantity: 1, unitPrice: 890 }] }, ORDER_MESSAGES.pieceTwice],
    ["no city", { city: "  " }, ORDER_MESSAGES.city],
    ["a missing address", { address: undefined }, ORDER_MESSAGES.address],
    ["a long address", { address: "a".repeat(301) }, ORDER_MESSAGES.address],
    ["long delivery notes", { deliveryNotes: "a".repeat(501) }, ORDER_MESSAGES.deliveryNotes],
    ["a long card message", { isGift: true, giftMessage: "a".repeat(201) }, ORDER_MESSAGES.giftMessage],
    ["a card message on a non-gift", { giftMessage: "Hi" }, ORDER_MESSAGES.giftOnly],
    ["a recipient without a name", { recipient: { name: "", phone: "+96171234567" } }, ORDER_MESSAGES.recipientName],
    ["a recipient with a foreign phone", { recipient: { name: "Rita", phone: "+33612345678" } }, BAD_PHONE],
  ])("refuses %s with the shop's message", (_label, change, expected) => {
    expect(message({ ...valid, ...change })).toBe(expected)
  })

  it.each([
    ["a quantity of 0", { quantity: 0 }],
    ["half a piece", { quantity: 1.5 }],
    ["a price of 0", { unitPrice: 0 }],
    ["a text product id", { productId: "5" }],
    ["an unknown key on a line", { name: "Qadisha" }],
  ])("refuses a line with %s, in the shop's words", (_label, change) => {
    expect(message({ ...valid, items: [{ ...valid.items[0], ...change }] })).toBe(ORDER_MESSAGES.badLine)
  })

  it.each([
    ["an unknown key", { ...valid, total: 0 }],
    ["an unknown key on a line", { ...valid, items: [{ ...valid.items[0], name: "Qadisha" }] }],
    ["a quantity of 0", { ...valid, items: [{ ...valid.items[0], quantity: 0 }] }],
    ["half a piece", { ...valid, items: [{ ...valid.items[0], quantity: 1.5 }] }],
    ["a price of 0", { ...valid, items: [{ ...valid.items[0], unitPrice: 0 }] }],
    ["a text product id", { ...valid, items: [{ ...valid.items[0], productId: "5" }] }],
  ])("refuses %s", (_label, body) => {
    expect(placeOrderSchema.safeParse(body).success).toBe(false)
  })
})
