import type { CustomMessageTriggerEvent, PostAuthenticationTriggerEvent, PostConfirmationTriggerEvent, PreSignUpTriggerEvent } from "aws-lambda"
import { ZodError } from "zod"
import { checkSignUp, syncCustomer } from "../services/customerService"
import { renderCodeEmail, type CodeEmailKind } from "../views/codeEmails"

// Cognito pre-sign-up trigger (customer pool): refuses the account before it exists when the email, name or
// phone breaks the customers table's rules. Cognito shows the thrown message as "PreSignUp failed with error <message>".
export const preSignUp = async (event: PreSignUpTriggerEvent): Promise<PreSignUpTriggerEvent> => {
  try {
    checkSignUp(event.request.userAttributes)
  } catch (err) {
    if (err instanceof ZodError) throw new Error(err.issues[0]?.message ?? "Invalid sign-up")
    throw err
  }
  return event
}

// Cognito post-confirmation AND post-authentication trigger (customer pool): makes the customers row when the
// email is confirmed, and again on any sign-in if that first try failed. It never throws: an error here would
// stop the customer confirming or signing in, while a missing row only refuses the order routes until the next sign-in.
export const sync = async <E extends PostConfirmationTriggerEvent | PostAuthenticationTriggerEvent>(event: E): Promise<E> => {
  const attributes = event.request.userAttributes
  try {
    await syncCustomer(attributes.sub, attributes)
  } catch (err) {
    // The message only: a database error's details can hold the customer's email and phone.
    console.error("Customer row not made:", attributes.sub, err instanceof Error ? err.message : err)
  }
  return event
}

const CODE_EMAILS: Partial<Record<CustomMessageTriggerEvent["triggerSource"], CodeEmailKind>> = {
  CustomMessage_SignUp: "signUp",
  CustomMessage_ResendCode: "signUp",
  CustomMessage_ForgotPassword: "forgotPassword",
  CustomMessage_UpdateUserAttribute: "newEmail",
  CustomMessage_VerifyUserAttribute: "newEmail",
}

// Cognito custom message trigger (customer pool): the code emails in Glowstone's design. Other messages (an
// admin-made account, a sign-in code; the shop uses neither) keep Cognito's own. It never throws: an error here would
// stop the sign-up or the reset, while an unbranded email still carries the code.
export const customMessage = async (event: CustomMessageTriggerEvent): Promise<CustomMessageTriggerEvent> => {
  const kind = CODE_EMAILS[event.triggerSource]
  if (!kind) return event
  try {
    const code = event.request.codeParameter
    if (!code) throw new Error("No code placeholder")
    const email = renderCodeEmail(kind, event.request.userAttributes.name, code)
    event.response.emailSubject = email.subject
    event.response.emailMessage = email.html
  } catch (err) {
    console.error("Custom message not made:", event.triggerSource, err instanceof Error ? err.message : String(err))
  }
  return event
}
