import { ForbiddenError } from "../lib/errors"
import { findCustomer, insertCustomer } from "../models/customerModel"
import { cognitoCustomerSchema } from "../schemas/customer.schema"
import type { Me } from "../types/customer"

export const NO_CUSTOMER_ROW = "Your account isn't ready yet. Please sign out and sign in again."

// Before Cognito creates an account: throws the shop's message when the email, name or phone breaks the table's rules.
export function checkSignUp(attributes: Record<string, string | undefined>): void {
  cognitoCustomerSchema.parse(attributes)
}

export const EMAIL_NOT_VERIFIED = "Email not verified"

// After the email is confirmed, and again on every sign-in: makes the customers row if it isn't there yet.
// Only for a verified email: order emails go there, and nobody may hold an address they can't read.
export async function syncCustomer(sub: string, attributes: Record<string, string | undefined>): Promise<void> {
  if (attributes.email_verified !== "true") throw new Error(EMAIL_NOT_VERIFIED)
  const { email, name, phone_number } = cognitoCustomerSchema.parse(attributes)
  await insertCustomer({ id: sub, email, name, phone: phone_number })
}

export async function getMe(sub: string): Promise<Me> {
  const customer = await findCustomer(sub)
  // Signing in makes the row, so a missing one means that step failed (e.g. the database was briefly unreachable).
  if (!customer) throw new ForbiddenError(NO_CUSTOMER_ROW)
  return { email: customer.email, name: customer.name, phone: customer.phone }
}
