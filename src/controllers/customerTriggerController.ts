import type { PostAuthenticationTriggerEvent, PostConfirmationTriggerEvent, PreSignUpTriggerEvent } from "aws-lambda"
import { ZodError } from "zod"
import { checkSignUp, syncCustomer } from "../services/customerService"

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
