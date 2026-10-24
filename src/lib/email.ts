import { CognitoIdentityProviderClient, ListUsersCommand, type UserType } from "@aws-sdk/client-cognito-identity-provider"
import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2"
import type { RenderedEmail } from "../views/emailLayout"
import { requiredEnv } from "./env"

let ses: SESv2Client | undefined
let cognito: CognitoIdentityProviderClient | undefined

// Sends one email through SES (Glowstone <noreply@glowstonelb.com>, replies go to Omar's inbox).
export async function sendEmail(to: string, email: RenderedEmail): Promise<void> {
  ses ??= new SESv2Client({})
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: requiredEnv("EMAIL_FROM"),
      ReplyToAddresses: [requiredEnv("EMAIL_REPLY_TO")],
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: email.subject, Charset: "UTF-8" },
          Body: { Html: { Data: email.html, Charset: "UTF-8" }, Text: { Data: email.text, Charset: "UTF-8" } },
        },
      },
    }),
  )
}

const attribute = (user: UserType, name: string) => user.Attributes?.find((a) => a.Name === name)?.Value

// Every enabled admin with a verified email, read from the admin pool each time (a new admin gets alerts at once,
// a disabled one stops).
export async function listAdminEmails(): Promise<string[]> {
  cognito ??= new CognitoIdentityProviderClient({})
  const emails: string[] = []
  let token: string | undefined
  do {
    const page = await cognito.send(
      new ListUsersCommand({ UserPoolId: requiredEnv("ADMIN_USER_POOL_ID"), PaginationToken: token, AttributesToGet: ["email", "email_verified"] }),
    )
    for (const user of page.Users ?? []) {
      const email = attribute(user, "email")
      if (user.Enabled && email && attribute(user, "email_verified") === "true") emails.push(email)
    }
    token = page.PaginationToken
  } while (token)
  return emails
}
