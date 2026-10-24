import type { CustomMessageTriggerEvent, PostConfirmationTriggerEvent, PreSignUpTriggerEvent } from "aws-lambda"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BAD_PHONE } from "../schemas/customer.schema"
import { syncCustomer } from "../services/customerService"
import { customMessage, preSignUp, sync } from "./customerTriggerController"

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

describe("customMessage", () => {
  const messageEvent = (triggerSource: string, attributes: Record<string, string> = userAttributes) =>
    ({
      triggerSource,
      request: { userAttributes: attributes, codeParameter: "{####}", usernameParameter: null },
      response: { smsMessage: null, emailMessage: null, emailSubject: null },
    }) as unknown as CustomMessageTriggerEvent

  it.each([
    ["CustomMessage_SignUp", "Your Glowstone sign-up code"],
    ["CustomMessage_ResendCode", "Your Glowstone sign-up code"],
    ["CustomMessage_ForgotPassword", "Reset your Glowstone password"],
    ["CustomMessage_UpdateUserAttribute", "Confirm your new email"],
    ["CustomMessage_VerifyUserAttribute", "Confirm your new email"],
  ])("%s: the branded email with Cognito's code placeholder", async (source, subject) => {
    const event = await customMessage(messageEvent(source))
    expect(event.response.emailSubject).toBe(subject)
    expect(event.response.emailMessage).toContain("{####}")
    expect(event.response.smsMessage).toBeNull()
  })

  it("greets by the account's name", async () => {
    const event = await customMessage(messageEvent("CustomMessage_SignUp"))
    expect(event.response.emailMessage).toContain("Welcome, Sara.")
  })

  it("leaves other messages (an admin-made account, a sign-in code) to Cognito", async () => {
    for (const source of ["CustomMessage_AdminCreateUser", "CustomMessage_Authentication"]) {
      const event = messageEvent(source)
      expect((await customMessage(event)).response).toEqual({ smsMessage: null, emailMessage: null, emailSubject: null })
    }
  })

  it("never blocks the customer: on an error Cognito sends its own default email", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    const broken = { triggerSource: "CustomMessage_SignUp", request: {}, response: { emailMessage: null, emailSubject: null } } as unknown as CustomMessageTriggerEvent
    expect((await customMessage(broken)).response).toEqual({ emailMessage: null, emailSubject: null })
    expect(log).toHaveBeenCalledWith("Custom message not made:", "CustomMessage_SignUp", expect.any(String))
    log.mockRestore()
  })
})
