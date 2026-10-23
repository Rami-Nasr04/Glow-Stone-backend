import type { PostConfirmationTriggerEvent, PreSignUpTriggerEvent } from "aws-lambda"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BAD_PHONE } from "../schemas/customer.schema"
import { syncCustomer } from "../services/customerService"
import { preSignUp, sync } from "./customerTriggerController"

vi.mock("../services/customerService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/customerService")>()),
  syncCustomer: vi.fn(),
}))

const SUB = "1b5c2a4e-8f0d-4c3b-9a71-2e6d5f8a9b10"
const userAttributes = { sub: SUB, email: "sara@example.com", name: "Sara Khoury", phone_number: "+96171234567" }
const signUpEvent = (attributes: Record<string, string>) =>
  ({ triggerSource: "PreSignUp_SignUp", request: { userAttributes: attributes }, response: {} }) as unknown as PreSignUpTriggerEvent
const confirmEvent = { triggerSource: "PostConfirmation_ConfirmSignUp", request: { userAttributes }, response: {} } as unknown as PostConfirmationTriggerEvent

beforeEach(() => {
  vi.mocked(syncCustomer).mockReset()
})

describe("preSignUp", () => {
  it("hands the event back for valid attributes", async () => {
    const event = signUpEvent(userAttributes)
    expect(await preSignUp(event)).toBe(event)
  })

  it("refuses with the shop's message, which Cognito passes to the form", async () => {
    await expect(preSignUp(signUpEvent({ ...userAttributes, phone_number: "+33612345678" }))).rejects.toThrow(BAD_PHONE)
  })
})

describe("sync", () => {
  it("makes the row from the sub and the attributes", async () => {
    expect(await sync(confirmEvent)).toBe(confirmEvent)
    expect(syncCustomer).toHaveBeenCalledWith(SUB, userAttributes)
  })

  it("never blocks the customer when the row can't be made, and logs no personal details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(syncCustomer).mockRejectedValue(Object.assign(new Error("connection lost"), { detail: "sara@example.com" }))
    expect(await sync(confirmEvent)).toBe(confirmEvent)
    expect(log).toHaveBeenCalledWith("Customer row not made:", SUB, "connection lost")
    log.mockRestore()
  })
})
