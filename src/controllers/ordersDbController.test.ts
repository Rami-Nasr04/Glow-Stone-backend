import { beforeEach, describe, expect, it, vi } from "vitest"
import { ConflictError, OrderRefusedError } from "../lib/errors"
import { advanceOrder, cancelAdminOrder, getAdminOrder } from "../services/adminOrderService"
import { cancelCustomerOrder, placeOrder } from "../services/orderService"
import type { AdminOrder, Order } from "../types/order"
import { run } from "./ordersDbController"

vi.mock("../services/orderService")
vi.mock("../services/adminOrderService")

const SUB = "1b5c2a4e-8f0d-4c3b-9a71-2e6d5f8a9b10"
const order = { id: 7, number: "GS-0007" } as Order
const admin = { ...order, customer: { email: "sara@example.com" } } as AdminOrder
const input = { requestId: "8e03978e-40d5-43e8-bc93-6894a57f9324", items: [{ productId: 5, quantity: 1, unitPrice: 890 }], recipient: null, city: "J", address: "A", deliveryNotes: null, isGift: false, giftMessage: null }

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getAdminOrder).mockResolvedValue(admin)
})

describe("ordersDb", () => {
  it("places an order and hands back both views", async () => {
    vi.mocked(placeOrder).mockResolvedValue({ order, repeat: false })
    expect(await run({ op: "place", customerId: SUB, input })).toEqual({ ok: true, data: { order, admin } })
    expect(placeOrder).toHaveBeenCalledWith(SUB, input)
    expect(getAdminOrder).toHaveBeenCalledWith(7)
  })

  it("marks a repeat of an order already made with this key", async () => {
    vi.mocked(placeOrder).mockResolvedValue({ order, repeat: true })
    expect(await run({ op: "place", customerId: SUB, input })).toEqual({ ok: true, data: { order, admin, repeat: true } })
  })

  it("cancels a customer's order", async () => {
    vi.mocked(cancelCustomerOrder).mockResolvedValue(order)
    expect(await run({ op: "customerCancel", customerId: SUB, orderId: 7 })).toEqual({ ok: true, data: { order, admin } })
    expect(cancelCustomerOrder).toHaveBeenCalledWith(SUB, 7)
  })

  it("moves and cancels for the studio", async () => {
    vi.mocked(advanceOrder).mockResolvedValue(admin)
    vi.mocked(cancelAdminOrder).mockResolvedValue(admin)
    expect(await run({ op: "advance", orderId: 7, status: "confirmed" })).toEqual({ ok: true, data: { order: admin, admin } })
    expect(advanceOrder).toHaveBeenCalledWith(7, "confirmed")
    expect(await run({ op: "adminCancel", orderId: 7 })).toEqual({ ok: true, data: { order: admin, admin } })
  })

  it("turns a refusal into the API answer it becomes", async () => {
    vi.mocked(placeOrder).mockRejectedValue(new OrderRefusedError("PRICE_CHANGED", "The price of Arz has changed. Please check your cart.", 1))
    const result = await run({ op: "place", customerId: SUB, input })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.statusCode).toBe(409)
    expect(JSON.parse(result.response.body as string).error).toEqual({
      code: "PRICE_CHANGED",
      message: "The price of Arz has changed. Please check your cart.",
      productId: 1,
    })
  })

  it("answers 409 CONFLICT for a refused step", async () => {
    vi.mocked(advanceOrder).mockRejectedValue(new ConflictError("Confirm the order first."))
    const result = await run({ op: "advance", orderId: 7, status: "delivered" })
    expect(result).toMatchObject({ ok: false, response: { statusCode: 409 } })
  })

  it("answers 500 for an unknown op", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(await run({ op: "drop" } as never)).toMatchObject({ ok: false, response: { statusCode: 500 } })
  })
})
