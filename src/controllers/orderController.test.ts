import type { APIGatewayProxyEventV2 } from "aws-lambda"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ConflictError, OrderRefusedError } from "../lib/errors"
import { ORDER_MESSAGES } from "../schemas/order.schema"
import { cancelCustomerOrder, getOrder, listOrders, placeOrder } from "../services/orderService"
import type { Order } from "../types/order"
import { cancel, get, list, place } from "./orderController"

vi.mock("../services/orderService", async (importOriginal) => {
  const real = await importOriginal<typeof import("../services/orderService")>()
  return { ...real, placeOrder: vi.fn(), listOrders: vi.fn(), getOrder: vi.fn(), cancelCustomerOrder: vi.fn() }
})

const POOL = "eu-central-1_ShopPool1"
const CLIENT = "shopclient456"
const SUB = "1b5c2a4e-8f0d-4c3b-9a71-2e6d5f8a9b10"
const claims = { sub: SUB, iss: `https://cognito-idp.eu-central-1.amazonaws.com/${POOL}`, token_use: "access", client_id: CLIENT }

const event = ({ body, id, signedIn = true }: { body?: unknown; id?: string; signedIn?: boolean } = {}) =>
  ({
    body: body === undefined ? undefined : JSON.stringify(body),
    pathParameters: id === undefined ? undefined : { id },
    requestContext: signedIn ? { authorizer: { jwt: { claims } } } : {},
  }) as unknown as APIGatewayProxyEventV2
const body = (res: { body?: string }) => JSON.parse(res.body ?? "")

const anOrder = { id: 7, number: "GS-0007", status: "pending" } as Order
const validBody = { items: [{ productId: 5, quantity: 1, unitPrice: 890 }], city: "Jounieh", address: "Main road" }

beforeEach(() => {
  vi.mocked(placeOrder).mockReset()
  vi.mocked(listOrders).mockReset()
  vi.mocked(getOrder).mockReset()
  vi.mocked(cancelCustomerOrder).mockReset()
  vi.stubEnv("AWS_REGION", "eu-central-1")
  vi.stubEnv("CUSTOMER_USER_POOL_ID", POOL)
  vi.stubEnv("CUSTOMER_APP_CLIENT_ID", CLIENT)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("POST /orders", () => {
  it("answers 201 with the order, for the token's customer and the parsed body", async () => {
    vi.mocked(placeOrder).mockResolvedValue(anOrder)
    const res = await place(event({ body: { ...validBody, deliveryNotes: "" } }))
    expect(res.statusCode).toBe(201)
    expect(body(res).data).toEqual(anOrder)
    expect(placeOrder).toHaveBeenCalledWith(SUB, {
      ...validBody,
      recipient: null,
      deliveryNotes: null,
      isGift: false,
      giftMessage: null,
    })
  })

  it("answers 400 VALIDATION with the shop's message", async () => {
    const res = await place(event({ body: { ...validBody, city: "" } }))
    expect(res.statusCode).toBe(400)
    expect(body(res).error).toEqual({ code: "VALIDATION", message: ORDER_MESSAGES.city })
    expect(placeOrder).not.toHaveBeenCalled()
  })

  it("answers 409 with the refusal's code, message and piece", async () => {
    vi.mocked(placeOrder).mockRejectedValue(new OrderRefusedError("UNAVAILABLE", "Nahr is sold out.", 2))
    const res = await place(event({ body: validBody }))
    expect(res.statusCode).toBe(409)
    expect(body(res).error).toEqual({ code: "UNAVAILABLE", message: "Nahr is sold out.", productId: 2 })
  })

  it("answers 401 without a customer token", async () => {
    const res = await place(event({ body: validBody, signedIn: false }))
    expect(res.statusCode).toBe(401)
    expect(placeOrder).not.toHaveBeenCalled()
  })
})

describe("GET /me/orders", () => {
  it("answers the customer's list", async () => {
    vi.mocked(listOrders).mockResolvedValue([])
    const res = await list(event())
    expect(res.statusCode).toBe(200)
    expect(body(res).data).toEqual([])
    expect(listOrders).toHaveBeenCalledWith(SUB)
  })
})

describe("GET /me/orders/{id}", () => {
  it("answers the order", async () => {
    vi.mocked(getOrder).mockResolvedValue(anOrder)
    const res = await get(event({ id: "7" }))
    expect(body(res).data).toEqual(anOrder)
    expect(getOrder).toHaveBeenCalledWith(SUB, 7)
  })

  it.each(["abc", "0", "-1", "1.5", "9999999999", "07a"])("answers 404 for the id %s without asking the database", async (id) => {
    const res = await get(event({ id }))
    expect(res.statusCode).toBe(404)
    expect(body(res).error).toEqual({ code: "NOT_FOUND", message: "Order not found" })
    expect(getOrder).not.toHaveBeenCalled()
  })
})

describe("POST /me/orders/{id}/cancel", () => {
  it("answers 200 with the cancelled order", async () => {
    vi.mocked(cancelCustomerOrder).mockResolvedValue({ ...anOrder, status: "cancelled" })
    const res = await cancel(event({ id: "7" }))
    expect(res.statusCode).toBe(200)
    expect(cancelCustomerOrder).toHaveBeenCalledWith(SUB, 7)
  })

  it("answers 409 CONFLICT when it can no longer be cancelled", async () => {
    vi.mocked(cancelCustomerOrder).mockRejectedValue(new ConflictError("This order can no longer be cancelled. Please contact Omar."))
    const res = await cancel(event({ id: "7" }))
    expect(res.statusCode).toBe(409)
    expect(body(res).error.code).toBe("CONFLICT")
  })
})
