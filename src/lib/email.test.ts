import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { listAdminEmails, sendEmail } from "./email"

const sent = vi.hoisted(() => ({ ses: [] as unknown[], cognito: [] as unknown[], pages: [] as unknown[] }))

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    send(command: { input: unknown }) {
      sent.ses.push(command.input)
      return Promise.resolve({})
    }
  },
  SendEmailCommand: class {
    constructor(readonly input: unknown) {}
  },
}))

vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: class {
    send(command: { input: unknown }) {
      sent.cognito.push(command.input)
      return Promise.resolve(sent.pages.shift())
    }
  },
  ListUsersCommand: class {
    constructor(readonly input: unknown) {}
  },
}))


const user = (email: string, verified: string, enabled = true) => ({
  Enabled: enabled,
  Attributes: [
    { Name: "email", Value: email },
    { Name: "email_verified", Value: verified },
  ],
})

beforeEach(() => {
  sent.ses = []
  sent.cognito = []
  vi.stubEnv("EMAIL_FROM", "Glowstone <noreply@glowstonelb.com>")
  vi.stubEnv("EMAIL_REPLY_TO", "glowstone216@gmail.com")
  vi.stubEnv("ADMIN_USER_POOL_ID", "eu-central-1_AdminPool")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("sendEmail()", () => {
  it("sends HTML and text from Glowstone, replies to Omar", async () => {
    await sendEmail("sara@example.com", { subject: "Hi", html: "<p>Hi</p>", text: "Hi" })
    expect(sent.ses).toEqual([
      {
        FromEmailAddress: "Glowstone <noreply@glowstonelb.com>",
        ReplyToAddresses: ["glowstone216@gmail.com"],
        Destination: { ToAddresses: ["sara@example.com"] },
        Content: {
          Simple: {
            Subject: { Data: "Hi", Charset: "UTF-8" },
            Body: { Html: { Data: "<p>Hi</p>", Charset: "UTF-8" }, Text: { Data: "Hi", Charset: "UTF-8" } },
          },
        },
      },
    ])
  })
})

describe("listAdminEmails()", () => {
  it("returns enabled admins with a verified email, across pages", async () => {
    sent.pages = [
      { Users: [user("rami@example.com", "true"), user("test@example.com", "true", false)], PaginationToken: "next" },
      { Users: [user("omar@example.com", "true"), user("new@example.com", "false")] },
    ]
    expect(await listAdminEmails()).toEqual(["rami@example.com", "omar@example.com"])
    expect(sent.cognito).toEqual([
      { UserPoolId: "eu-central-1_AdminPool", PaginationToken: undefined, AttributesToGet: ["email", "email_verified"] },
      { UserPoolId: "eu-central-1_AdminPool", PaginationToken: "next", AttributesToGet: ["email", "email_verified"] },
    ])
  })
})
