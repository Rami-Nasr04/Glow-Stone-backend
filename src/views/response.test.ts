import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import {
  ForbiddenError,
  InvalidBodyError,
  NotFoundError,
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
