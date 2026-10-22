import { describe, expect, it } from "vitest"
import { BAD_EMAIL, subscribeSchema } from "./subscriber.schema"

const parse = (body: unknown) => subscribeSchema.safeParse(body)
const message = (body: unknown) => {
  const result = parse(body)
  return result.success ? null : result.error.issues[0]?.message
}

describe("subscribeSchema", () => {
  it("trims and lowercases the email, and defaults rejoin and the trap", () => {
    expect(parse({ email: "  Sara@Example.COM " }).data).toEqual({ email: "sara@example.com", rejoin: false, website: "" })
  })

  it("keeps rejoin and the trap when sent", () => {
    expect(parse({ email: "sara@example.com", rejoin: true, website: "x" }).data).toEqual({
      email: "sara@example.com",
      rejoin: true,
      website: "x",
    })
  })

  it.each([
    ["missing", {}],
    ["not text", { email: 5 }],
    ["empty", { email: "  " }],
    ["no @", { email: "sara.example.com" }],
    ["no dot in the domain", { email: "sara@example" }],
    ["a space inside", { email: "sa ra@example.com" }],
    ["two @", { email: "sara@@example.com" }],
    ["over 254 characters", { email: `${"a".repeat(245)}@example.com` }],
  ])("refuses an email that is %s with the shop's message", (_label, body) => {
    expect(message(body)).toBe(BAD_EMAIL)
  })

  it("accepts plus addresses and non-Latin letters", () => {
    expect(parse({ email: "omar+news@example.com" }).success).toBe(true)
    expect(parse({ email: "عمر@مثال.com" }).success).toBe(true)
  })

  it("refuses unknown keys and a rejoin that isn't true or false", () => {
    expect(parse({ email: "sara@example.com", name: "Sara" }).success).toBe(false)
    expect(parse({ email: "sara@example.com", rejoin: "yes" }).success).toBe(false)
  })
})
