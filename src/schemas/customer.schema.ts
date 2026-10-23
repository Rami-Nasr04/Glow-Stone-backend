import { z } from "zod"
import { emailField } from "./subscriber.schema"

export const BAD_NAME = "Please enter your name (up to 100 characters)."
export const BAD_PHONE = "Please enter a Lebanese number, like 71 234 567."

// The shop's sign-up form sends +961 then 7 or 8 digits, without the leading 0 (same rule as 005_customers.sql).
export const LEBANESE_PHONE = /^\+961\d{7,8}$/

export const nameField = z.string({ error: BAD_NAME }).trim().min(1, BAD_NAME).max(100, BAD_NAME)
export const phoneField = z.string({ error: BAD_PHONE }).regex(LEBANESE_PHONE, BAD_PHONE)

// The attributes Cognito hands its sign-up triggers. Anyone can call Cognito's sign-up directly, skipping the
// shop's form, so the pre-sign-up check holds them to the customers table's rules before the account exists.
export const cognitoCustomerSchema = z.object({
  email: emailField,
  name: nameField,
  phone_number: phoneField,
})

export type CognitoCustomer = z.infer<typeof cognitoCustomerSchema>
