import type { APIGatewayProxyEventV2 } from "aws-lambda"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { callOrdersDb } from "../lib/ordersDb"
import { ORDER_MESSAGES } from "../schemas/order.schema"
import { notifyOrderPlaced, notifyOrderStatus } from "../services/orderNotificationService"
import type { AdminOrder, Order } from "../types/order"
import { fail } from "../views/response"
import { adminAdvance, adminCancel, cancel, place } from "./orderActionController"

vi.mock("../lib/ordersDb")
vi.mock("../services/orderNotificationService")

const SHOP_POOL = "eu-central-1_ShopPool1"
const SHOP_CLIENT = "shopclient456"
const ADMIN_POOL = "eu-central-1_AdminPool"
const ADMIN_CLIENT = "studioclient"
const SUB = "1b5c2a4e-8f0d-4c3b-9a71-2e6d5f8a9b10"
const customerClaims = { sub: SUB, iss: `https://cognito-idp.eu-central-1.amazonaws.com/${SHOP_POOL}`, token_use: "access", client_id: SHOP_CLIENT }
const adminClaims = { sub: "a-1", iss: `https://cognito-idp.eu-central-1.amazonaws.com/${ADMIN_POOL}`, token_use: "access", client_id: ADMIN_CLIENT }

const event = ({ body, id, claims }: { body?: unknown; id?: string; claims?: object }) =>
  ({
    body: body === undefined ? undefined : JSON.stringify(body),
    pathParameters: id === undefined ? undefined : { id },
    requestContext: claims ? { authorizer: { jwt: { claims } } } : {},
  }) as unknown as APIGatewayProxyEventV2
const body = (res: { body?: string }) => JSON.parse(res.body ?? "")

const order = { id: 7, number: "GS-0007", status: "pending", canCancel: true } as Order
const admin = { ...order, canCancel: true, customer: { id: SUB, email: "sara@example.com", name: "Sara", phone: "+96171234567" } } as AdminOrder
const validBody = { items: [{ productId: 5, quantity: 1, unitPrice: 890 }], city: "Jounieh", address: "Main road" }
const refusal = fail("UNAVAILABLE", "Nahr is sold out.", 409, 2)

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("AWS_REGION", "eu-central-1")
  vi.stubEnv("CUSTOMER_USER_POOL_ID", SHOP_POOL)
  vi.stubEnv("CUSTOMER_APP_CLIENT_ID", SHOP_CLIENT)
  vi.stubEnv("ADMIN_USER_POOL_ID", ADMIN_POOL)
  vi.stubEnv("ADMIN_APP_CLIENT_ID", ADMIN_CLIENT)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("POST /orders", () => {
  it("places the order through ordersDb, emails, then answers 201 with the customer's view", async () => {
    vi.mocked(callOrdersDb).mockResolvedValue({ ok: true, data: { order, admin } })
    const res = await place(event({ body: { ...validBody, giftMessage: "" }, claims: customerClaims }))
    expect(res.statusCode).toBe(201)
    expect(body(res).data).toEqual(order)
    expect(callOrdersDb).toHaveBeenCalledWith({
      op: "place",
      customerId: SUB,
      input: { ...validBody, recipient: null, deliveryNotes: null, isGift: false, giftMessage: null },
    })
    expect(notifyOrderPlaced).toHaveBeenCalledWith(admin)
  })

  it("answers a refusal exactly as ordersDb gave it, and emails nobody", async () => {
    vi.mocked(callOrdersDb).mockResolvedValue({ ok: false, response: refusal })
    const res = await place(event({ body: validBody, claims: customerClaims }))
    expect(res).toEqual(refusal)
    expect(notifyOrderPlaced).not.toHaveBeenCalled()
  })

  it("checks the body before calling ordersDb", async () => {
    const res = await place(event({ body: { ...validBody, city: "" }, claims: customerClaims }))
    expect(body(res).error).toEqual({ code: "VALIDATION", message: ORDER_MESSAGES.city })
    expect(callOrdersDb).not.toHaveBeenCalled()
  })

  it("answers 401 for no token or an admin's token", async () => {
    expect((await place(event({ body: validBody }))).statusCode).toBe(401)
    expect((await place(event({ body: validBody, claims: adminClaims }))).statusCode).toBe(401)
    expect(callOrdersDb).not.toHaveBeenCalled()
  })

  it("answers 500 without details when ordersDb can't be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(callOrdersDb).mockRejectedValue(new Error("ordersDb failed (Unhandled): boom"))
    const res = await place(event({ body: validBody, claims: customerClaims }))
    expect(res.statusCode).toBe(500)
    expect(body(res).error).toEqual({ code: "INTERNAL", message: "Internal server error" })
  })
})

describe("POST /me/orders/{id}/cancel", () => {
  it("cancels the customer's own order and emails them", async () => {
    vi.mocked(callOrdersDb).mockResolvedValue({ ok: true, data: { order, admin } })
    const res = await cancel(event({ id: "7", claims: customerClaims }))
    expect(res.statusCode).toBe(200)
    expect(callOrdersDb).toHaveBeenCalledWith({ op: "customerCancel", customerId: SUB, orderId: 7 })
    expect(notifyOrderStatus).toHaveBeenCalledWith("cancelled", admin)
  })

  it("answers 404 for a bad id without calling ordersDb", async () => {
    expect((await cancel(event({ id: "x", claims: customerClaims }))).statusCode).toBe(404)
    expect(callOrdersDb).not.toHaveBeenCalled()
  })
})

describe("POST /admin/orders/{id}/status", () => {
  it("moves the order forward and emails that step", async () => {
    vi.mocked(callOrdersDb).mockResolvedValue({ ok: true, data: { order: admin, admin } })
    const res = await adminAdvance(event({ id: "7", body: { status: "out_for_delivery" }, claims: adminClaims }))
    expect(res.statusCode).toBe(200)
    expect(body(res).data).toEqual(admin)
    expect(callOrdersDb).toHaveBeenCalledWith({ op: "advance", orderId: 7, status: "out_for_delivery" })
    expect(notifyOrderStatus).toHaveBeenCalledWith("out_for_delivery", admin)
  })

  it("refuses cancelled (it has its own route) and a customer's token", async () => {
    expect((await adminAdvance(event({ id: "7", body: { status: "cancelled" }, claims: adminClaims }))).statusCode).toBe(400)
    expect((await adminAdvance(event({ id: "7", body: { status: "confirmed" }, claims: customerClaims }))).statusCode).toBe(401)
    expect(callOrdersDb).not.toHaveBeenCalled()
  })

  it("emails nobody when the step is refused", async () => {
    const conflict = fail("CONFLICT", "Confirm the order first.", 409)
    vi.mocked(callOrdersDb).mockResolvedValue({ ok: false, response: conflict })
    expect(await adminAdvance(event({ id: "7", body: { status: "delivered" }, claims: adminClaims }))).toEqual(conflict)
    expect(notifyOrderStatus).not.toHaveBeenCalled()
  })
})

describe("POST /admin/orders/{id}/cancel", () => {
  it("cancels and emails the customer", async () => {
    vi.mocked(callOrdersDb).mockResolvedValue({ ok: true, data: { order: admin, admin } })
    expect((await adminCancel(event({ id: "7", claims: adminClaims }))).statusCode).toBe(200)
    expect(callOrdersDb).toHaveBeenCalledWith({ op: "adminCancel", orderId: 7 })
    expect(notifyOrderStatus).toHaveBeenCalledWith("cancelled", admin)
  })
})
