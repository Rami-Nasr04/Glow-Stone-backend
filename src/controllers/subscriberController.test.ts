import type { APIGatewayProxyEventV2 } from "aws-lambda"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BAD_EMAIL } from "../schemas/subscriber.schema"
import { subscribe } from "../services/subscriberService"
import { create } from "./subscriberController"

vi.mock("../services/subscriberService")

const event = (body?: string) => ({ body }) as unknown as APIGatewayProxyEventV2
const body = (res: { body?: string }) => JSON.parse(res.body ?? "")

beforeEach(() => {
  vi.resetAllMocks()
})

describe("POST /subscribers", () => {
  it("answers 204 with no body once the email is handled", async () => {
    vi.mocked(subscribe).mockResolvedValue()
    const res = await create(event(JSON.stringify({ email: "Sara@Example.com", rejoin: true })))
    expect(res).toEqual({ statusCode: 204 })
    expect(subscribe).toHaveBeenCalledWith({ email: "sara@example.com", rejoin: true, website: "" })
  })

  it("answers 400 VALIDATION with the shop's message for a bad email", async () => {
    const res = await create(event(JSON.stringify({ email: "nope" })))
    expect(res.statusCode).toBe(400)
    expect(body(res).error).toEqual({ code: "VALIDATION", message: BAD_EMAIL })
    expect(subscribe).not.toHaveBeenCalled()
  })

  it("answers 400 for a body that isn't JSON", async () => {
    const res = await create(event("{"))
    expect(res.statusCode).toBe(400)
  })

  it("answers 500 without details when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(subscribe).mockRejectedValue(new Error("connection lost"))
    const res = await create(event(JSON.stringify({ email: "sara@example.com" })))
    expect(res.statusCode).toBe(500)
    expect(res.body).not.toContain("connection lost")
  })
})
