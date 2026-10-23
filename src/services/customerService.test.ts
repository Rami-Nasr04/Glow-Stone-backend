import { ZodError } from "zod"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ForbiddenError } from "../lib/errors"
import { findCustomer, insertCustomer } from "../models/customerModel"
import { BAD_PHONE } from "../schemas/customer.schema"
import { checkSignUp, getMe, NO_CUSTOMER_ROW, syncCustomer } from "./customerService"

vi.mock("../models/customerModel")

const SUB = "1b5c2a4e-8f0d-4c3b-9a71-2e6d5f8a9b10"
const attributes = { sub: SUB, email: "Sara@Example.com", email_verified: "true", name: "Sara Khoury ", phone_number: "+96171234567" }

beforeEach(() => {
  vi.resetAllMocks()
})

describe("checkSignUp()", () => {
  it("lets valid attributes through", () => {
    expect(() => checkSignUp(attributes)).not.toThrow()
  })

  it("throws the shop's message for a foreign phone", () => {
    expect(() => checkSignUp({ ...attributes, phone_number: "+33612345678" })).toThrow(BAD_PHONE)
  })
})

describe("syncCustomer()", () => {
  it("makes the row with the sub, a lowercased email and a trimmed name", async () => {
    await syncCustomer(SUB, attributes)
    expect(insertCustomer).toHaveBeenCalledWith({ id: SUB, email: "sara@example.com", name: "Sara Khoury", phone: "+96171234567" })
  })

  it("throws, saving nothing, when the attributes break the rules", async () => {
    await expect(syncCustomer(SUB, { ...attributes, name: "" })).rejects.toBeInstanceOf(ZodError)
    expect(insertCustomer).not.toHaveBeenCalled()
  })
})

describe("getMe()", () => {
  it("returns the email, name and phone", async () => {
    vi.mocked(findCustomer).mockResolvedValue({ id: SUB, email: "sara@example.com", name: "Sara Khoury", phone: "+96171234567" })
    expect(await getMe(SUB)).toEqual({ email: "sara@example.com", name: "Sara Khoury", phone: "+96171234567" })
  })

  it("refuses with 403 when the row is missing", async () => {
    vi.mocked(findCustomer).mockResolvedValue(null)
    await expect(getMe(SUB)).rejects.toEqual(new ForbiddenError(NO_CUSTOMER_ROW))
  })
})
