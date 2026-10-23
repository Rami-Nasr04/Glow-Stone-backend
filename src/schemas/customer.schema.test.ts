import { describe, expect, it } from "vitest"
import { BAD_EMAIL } from "./subscriber.schema"
import { BAD_NAME, BAD_PHONE, cognitoCustomerSchema } from "./customer.schema"

const valid = { email: "Sara@Example.com", name: "  Sara Khoury ", phone_number: "+96171234567" }
const message = (attributes: Record<string, unknown>) => {
  const result = cognitoCustomerSchema.safeParse(attributes)
  return result.success ? null : result.error.issues[0]?.message
}

describe("cognitoCustomerSchema", () => {
  it("lowercases the email and trims the name, as the table stores them", () => {
    expect(cognitoCustomerSchema.parse(valid)).toEqual({
      email: "sara@example.com",
      name: "Sara Khoury",
      phone_number: "+96171234567",
    })
  })

  it("ignores Cognito's other attributes (sub, email_verified, …)", () => {
    expect(cognitoCustomerSchema.parse({ ...valid, sub: "x", email_verified: "true" })).not.toHaveProperty("sub")
  })

  it("accepts a 7-digit number and an Arabic name", () => {
    expect(message({ ...valid, name: "عمر", phone_number: "+9613123456" })).toBeNull()
  })

  it.each([
    ["missing", undefined],
    ["only spaces", "   "],
    ["over 100 characters", "a".repeat(101)],
  ])("refuses a name that is %s", (_label, name) => {
    expect(message({ ...valid, name })).toBe(BAD_NAME)
  })

  it.each([
    ["missing", undefined],
    ["foreign", "+33612345678"],
    ["with the leading 0", "+961071234567"],
    ["too short", "+961123456"],
    ["too long", "+961712345678"],
  ])("refuses a phone that is %s", (_label, phone_number) => {
    expect(message({ ...valid, phone_number })).toBe(BAD_PHONE)
  })

  it("refuses a bad email with the shop's message", () => {
    expect(message({ ...valid, email: "sara@example" })).toBe(BAD_EMAIL)
  })
})
