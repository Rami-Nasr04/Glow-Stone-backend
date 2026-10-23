import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import {
  ConflictError,
  ForbiddenError,
  InvalidBodyError,
  NotFoundError,
  OrderRefusedError,
  RequestReusedError,
  UnauthorizedError,
  ValidationError,
} from "../lib/errors"
import { fail, handleError, ok } from "./response"

const body = (r: { body?: string }) => JSON.parse(r.body ?? "{}")

describe("ok()", () => {
  it("wraps data with success:true and defaults to 200", () => {
    const r = ok({ x: 1 })
    expect(r.statusCode).toBe(200)
    expect(r.headers).toEqual({ "Content-Type": "application/json" })
    expect(body(r)).toEqual({ success: true, data: { x: 1 } })
  })

  it("accepts a custom status code", () => {
    expect(ok({ created: true }, 201).statusCode).toBe(201)
  })
})

describe("fail()", () => {
  it("wraps the error with success:false and defaults to 400", () => {
    const r = fail("VALIDATION", "Bad input")
    expect(r.statusCode).toBe(400)
    expect(body(r)).toEqual({ success: false, error: { code: "VALIDATION", message: "Bad input" } })
  })
})

describe("handleError()", () => {
  it("maps ZodError to 400 VALIDATION", () => {
    const result = z.object({ name: z.string() }).safeParse({})
    const r = handleError(result.error)
    expect(r.statusCode).toBe(400)
    expect(body(r).error.code).toBe("VALIDATION")
  })

  it.each([
    [new InvalidBodyError(), 400, "VALIDATION"],
    [new ValidationError("nope"), 400, "VALIDATION"],
    [new UnauthorizedError(), 401, "UNAUTHORIZED"],
    [new ForbiddenError(), 403, "FORBIDDEN"],
    [new NotFoundError(), 404, "NOT_FOUND"],
  ])("maps %s to %i %s", (err, status, code) => {
    const r = handleError(err)
    expect(r.statusCode).toBe(status)
    expect(body(r).error.code).toBe(code)
  })

  it("maps an order refusal to 409 with its own code and the piece it is about", () => {
    const r = handleError(new OrderRefusedError("PRICE_CHANGED", "The price of Qadisha has changed. Please check your cart.", 5))
    expect(r.statusCode).toBe(409)
    expect(body(r).error).toEqual({
      code: "PRICE_CHANGED",
      message: "The price of Qadisha has changed. Please check your cart.",
      productId: 5,
    })
  })

  it("leaves productId out of an order refusal that isn't about one piece", () => {
    const r = handleError(new OrderRefusedError("ORDER_LIMIT", "For larger orders, please contact Omar."))
    expect(body(r).error).toEqual({ code: "ORDER_LIMIT", message: "For larger orders, please contact Omar." })
  })

  it("maps an order key sent with a different order to 422 REQUEST_REUSED", () => {
    const r = handleError(new RequestReusedError("Please check your cart and try again."))
    expect(r.statusCode).toBe(422)
    expect(body(r).error).toEqual({ code: "REQUEST_REUSED", message: "Please check your cart and try again." })
  })

  it("explains why a piece with orders can't be deleted", () => {
    const r = handleError({ code: "23503", constraint: "order_items_product_id_fkey" })
    expect(r.statusCode).toBe(409)
    expect(body(r).error.message).toBe("This piece has orders, so it can't be deleted. Keep it as a draft instead.")
  })

  it("maps ConflictError to 409 CONFLICT with its own message", () => {
    const r = handleError(new ConflictError("A piece can have at most 30 photos."))
    expect(r.statusCode).toBe(409)
    expect(body(r).error).toEqual({ code: "CONFLICT", message: "A piece can have at most 30 photos." })
  })

  it("maps Cognito exceptions by name", () => {
    const err = new Error("exists")
    err.name = "UsernameExistsException"
    expect(handleError(err).statusCode).toBe(409)
  })

  it("maps pg unique violation to 409 CONFLICT", () => {
    const r = handleError({ code: "23505" })
    expect(r.statusCode).toBe(409)
    expect(body(r).error.code).toBe("CONFLICT")
  })

  it.each([
    ["23514", "remaining_within_edition", 400, "VALIDATION", "remaining can't be more than editionSize"],
    ["23505", "products_published_name_unique", 409, "CONFLICT", "A published piece already has that name"],
  ])("names the database rule %s %s", (code, constraint, status, errorCode, message) => {
    const r = handleError({ code, constraint })
    expect(r.statusCode).toBe(status)
    expect(body(r).error).toEqual({ code: errorCode, message })
  })

  it("keeps the generic message for other constraints", () => {
    expect(body(handleError({ code: "23505", constraint: "something_else" })).error.message).toBe(
      "A record with that unique value already exists",
    )
  })

  it("falls back to 500 INTERNAL for unknown errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const r = handleError(new Error("boom"))
    expect(r.statusCode).toBe(500)
    expect(body(r).error.code).toBe("INTERNAL")
    spy.mockRestore()
  })
})
