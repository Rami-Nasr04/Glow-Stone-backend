import type { APIGatewayProxyEventV2 } from "aws-lambda"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ConflictError } from "../lib/errors"
import {
  advanceOrder,
  cancelAdminOrder,
  changeDeliveryFee,
  getAdminCustomer,
  getAdminOrder,
  listAdminCustomers,
  listAdminOrders,
} from "../services/adminOrderService"
import type { AdminOrder } from "../types/order"
import { advance, cancel, get, getCustomer, list, listCustomers, update } from "./adminOrderController"

vi.mock("../services/adminOrderService", async (importOriginal) => {
  const real = await importOriginal<typeof import("../services/adminOrderService")>()
  return {
    ...real,
    advanceOrder: vi.fn(),
    cancelAdminOrder: vi.fn(),
    changeDeliveryFee: vi.fn(),
    getAdminCustomer: vi.fn(),
    getAdminOrder: vi.fn(),
    listAdminCustomers: vi.fn(),
    listAdminOrders: vi.fn(),
  }
})

const POOL = "eu-central-1_AdminPool"
const CLIENT = "studioclient"
const adminClaims = { sub: "a-1", iss: `https://cognito-idp.eu-central-1.amazonaws.com/${POOL}`, token_use: "access", client_id: CLIENT }
const customerClaims = { ...adminClaims, iss: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ShopPool1", client_id: "shop" }

const event = ({ body, id, status, claims = adminClaims }: { body?: unknown; id?: string; status?: string; claims?: object } = {}) =>
  ({
    body: body === undefined ? undefined : JSON.stringify(body),
    pathParameters: id === undefined ? undefined : { id },
    queryStringParameters: status === undefined ? undefined : { status },
    requestContext: { authorizer: { jwt: { claims } } },
  }) as unknown as APIGatewayProxyEventV2
const body = (res: { body?: string }) => JSON.parse(res.body ?? "")

const anOrder = { id: 7, number: "GS-0007", status: "confirmed" } as AdminOrder
const SARA = "1b5c2a4e-8f0d-4c3b-9a71-2e6d5f8a9b10"

beforeEach(() => {
  vi.mocked(advanceOrder).mockReset()
  vi.mocked(cancelAdminOrder).mockReset()
  vi.mocked(changeDeliveryFee).mockReset()
  vi.mocked(getAdminCustomer).mockReset()
  vi.mocked(getAdminOrder).mockReset()
  vi.mocked(listAdminCustomers).mockReset()
  vi.mocked(listAdminOrders).mockReset()
  vi.stubEnv("AWS_REGION", "eu-central-1")
  vi.stubEnv("ADMIN_USER_POOL_ID", POOL)
  vi.stubEnv("ADMIN_APP_CLIENT_ID", CLIENT)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("studio order routes", () => {
  it("refuse a customer's token", async () => {
    for (const handler of [list, get, advance, cancel, update, listCustomers, getCustomer]) {
      expect((await handler(event({ id: "7", claims: customerClaims }))).statusCode).toBe(401)
    }
    expect(listAdminOrders).not.toHaveBeenCalled()
  })

  it("GET /admin/orders passes the status filter", async () => {
    vi.mocked(listAdminOrders).mockResolvedValue([])
    expect((await list(event({ status: "pending" }))).statusCode).toBe(200)
    expect(listAdminOrders).toHaveBeenCalledWith("pending")
    await list(event())
    expect(listAdminOrders).toHaveBeenLastCalledWith(undefined)
  })

  it("GET /admin/orders refuses an unknown status", async () => {
    const res = await list(event({ status: "lost" }))
    expect(res.statusCode).toBe(400)
    expect(body(res).error).toEqual({ code: "VALIDATION", message: "Unknown order status." })
  })

  it("GET /admin/orders/{id} answers the order, and 404 for a bad id", async () => {
    vi.mocked(getAdminOrder).mockResolvedValue(anOrder)
    expect(body(await get(event({ id: "7" }))).data).toEqual(anOrder)
    expect(getAdminOrder).toHaveBeenCalledWith(7)
    expect((await get(event({ id: "x" }))).statusCode).toBe(404)
  })

  it("POST /admin/orders/{id}/status moves it forward, and answers 409 with the reason", async () => {
    vi.mocked(advanceOrder).mockResolvedValue(anOrder)
    expect((await advance(event({ id: "7", body: { status: "confirmed" } }))).statusCode).toBe(200)
    expect(advanceOrder).toHaveBeenCalledWith(7, "confirmed")
    vi.mocked(advanceOrder).mockRejectedValue(new ConflictError("Confirm the order first."))
    const res = await advance(event({ id: "7", body: { status: "delivered" } }))
    expect(res.statusCode).toBe(409)
    expect(body(res).error).toEqual({ code: "CONFLICT", message: "Confirm the order first." })
  })

  it("POST /admin/orders/{id}/status refuses cancelled (it has its own route)", async () => {
    expect((await advance(event({ id: "7", body: { status: "cancelled" } }))).statusCode).toBe(400)
    expect(advanceOrder).not.toHaveBeenCalled()
  })

  it("POST /admin/orders/{id}/cancel cancels", async () => {
    vi.mocked(cancelAdminOrder).mockResolvedValue({ ...anOrder, status: "cancelled" })
    expect((await cancel(event({ id: "7" }))).statusCode).toBe(200)
    expect(cancelAdminOrder).toHaveBeenCalledWith(7)
  })

  it("PATCH /admin/orders/{id} sets the fee, and refuses a bad one", async () => {
    vi.mocked(changeDeliveryFee).mockResolvedValue(anOrder)
    expect((await update(event({ id: "7", body: { deliveryFee: 12.5 } }))).statusCode).toBe(200)
    expect(changeDeliveryFee).toHaveBeenCalledWith(7, 12.5)
    expect((await update(event({ id: "7", body: { deliveryFee: -1 } }))).statusCode).toBe(400)
    expect((await update(event({ id: "7", body: { deliveryFee: 5, status: "confirmed" } }))).statusCode).toBe(400)
  })

  it("GET /admin/customers lists them", async () => {
    vi.mocked(listAdminCustomers).mockResolvedValue([])
    expect((await listCustomers(event())).statusCode).toBe(200)
  })

  it("GET /admin/customers/{id} answers the customer, and 404 for an id that isn't a sub", async () => {
    vi.mocked(getAdminCustomer).mockResolvedValue({ id: SARA } as never)
    expect((await getCustomer(event({ id: SARA }))).statusCode).toBe(200)
    expect(getAdminCustomer).toHaveBeenCalledWith(SARA)
    const res = await getCustomer(event({ id: "1' or '1'='1" }))
    expect(res.statusCode).toBe(404)
    expect(body(res).error).toEqual({ code: "NOT_FOUND", message: "Customer not found" })
  })
})
