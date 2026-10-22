import { z } from "zod"

export const BAD_EMAIL = "Please enter a valid email."

// The same rule as the subscribers table (004_subscribers.sql), so a bad address gets the shop's message
// instead of a database error: something@something.something, no spaces, at most 254 characters.
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const badEmail = { error: BAD_EMAIL }

// POST /subscribers. rejoin = the person asked for news (footer, "notify me"), so an earlier unsubscribe is undone.
// website = the hidden spam trap: people never see it, so it stays empty.
export const subscribeSchema = z.strictObject({
  email: z.string(badEmail).trim().toLowerCase().max(254, badEmail).regex(EMAIL_SHAPE, badEmail),
  rejoin: z.boolean().default(false),
  website: z.string().max(500).default(""),
})

export type SubscribeInput = z.infer<typeof subscribeSchema>
