import type { APIGatewayProxyEventV2 } from "aws-lambda"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getOrder, listOrders } from "../services/orderService"
import type { Order } from "../types/order"
import { get, list } from "./orderController"

vi.mock("../services/orderService", async (importOriginal) => {
  const real = await importOriginal<typeof import("../services/orderService")>()
  return { ...real, listOrders: vi.fn(), getOrder: vi.fn() }
})

const POOL = "eu-central-1_ShopPool1"
const CLIENT = "shopclient456"
const SUB = "1b5c2a4e-8f0d-4c3b-9a71-2e6d5f8a9b10"
const claims = { sub: SUB, iss: `https://cognito-idp.eu-central-1.amazonaws.com/${POOL}`, token_use: "access", client_id: CLIENT }

const event = ({ id, signedIn = true }: { id?: string; signedIn?: boolean } = {}) =>
  ({
    pathParameters: id === undefined ? undefined : { id },
    requestContext: signedIn ? { authorizer: { jwt: { claims } } } : {},
  }) as unknown as APIGatewayProxyEventV2
const body = (res: { body?: string }) => JSON.parse(res.body ?? "")

const anOrder = { id: 7, number: "GS-0007", status: "pending" } as Order

beforeEach(() => {
  vi.mocked(listOrders).mockReset()
  vi.mocked(getOrder).mockReset()
  vi.stubEnv("AWS_REGION", "eu-central-1")
  vi.stubEnv("CUSTOMER_USER_POOL_ID", POOL)
  vi.stubEnv("CUSTOMER_APP_CLIENT_ID", CLIENT)
})

afterEach(() => {
  vi.unstubAllEnvs()
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


describe("customer order routes", () => {
  it("answer 401 without a customer token", async () => {
    expect((await list(event({ signedIn: false }))).statusCode).toBe(401)
    expect((await get(event({ id: "7", signedIn: false }))).statusCode).toBe(401)
  })
})
