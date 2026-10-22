import { executeQuery } from "../lib/db"

// Adds the email to the news list. An address already there keeps its joining time; rejoin also clears an
// earlier unsubscribe (only the footer and "notify me" send it, so the contact form never re-adds someone who said no).
export async function addSubscriber(email: string, rejoin: boolean): Promise<void> {
  await executeQuery(
    rejoin
      ? "insert into subscribers (email) values ($1) on conflict (email) do update set unsubscribed_at = null"
      : "insert into subscribers (email) values ($1) on conflict (email) do nothing",
    [email],
  )
}
