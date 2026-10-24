import { describe, expect, it } from "vitest"
import { CODE_EMAIL_MAX_LENGTH, renderCodeEmail, type CodeEmailKind } from "./codeEmails"

const CODE = "{####}"
const KINDS: CodeEmailKind[] = ["signUp", "forgotPassword", "newEmail"]

describe("renderCodeEmail()", () => {
  it("greets a new customer by first name and shows the code", () => {
    const email = renderCodeEmail("signUp", "Sara Khoury", CODE)
    expect(email.subject).toBe("Your Glowstone sign-up code")
    expect(email.html).toContain("Welcome, Sara.")
    expect(email.html).toContain("Enter this 6-digit code on the Glowstone page to confirm your email")
    expect(email.html).toContain(CODE)
    expect(email.html).toContain("The code works for 24 hours.")
  })

  it("explains a password reset, with its one-hour code", () => {
    const email = renderCodeEmail("forgotPassword", "Sara Khoury", CODE)
    expect(email.subject).toBe("Reset your Glowstone password")
    expect(email.html).toContain("Reset your password.")
    expect(email.html).toContain("The code works for 1 hour.")
    expect(email.html).toContain("your password stays the same")
  })

  it("confirms a new email address", () => {
    const email = renderCodeEmail("newEmail", "Sara Khoury", CODE)
    expect(email.subject).toBe("Confirm your new email")
    expect(email.html).toContain("your account keeps its current email")
  })

  it.each(KINDS)("%s: puts the code in exactly once, unescaped, so Cognito can replace it", (kind) => {
    const { html } = renderCodeEmail(kind, "Sara", CODE)
    expect(html.split(CODE)).toHaveLength(2)
  })

  it.each(KINDS)("%s: has the Glowstone design and no button", (kind) => {
    const { html } = renderCodeEmail(kind, "Sara", CODE)
    expect(html).toContain("GLOW<span aria-hidden=\"true\" style=\"color:#5A2A32;\">&bull;</span>STONE")
    expect(html).toContain("glowstone216@gmail.com")
    expect(html).not.toContain("<a href=\"http")
  })

  it("escapes the name, which the customer typed", () => {
    const { html } = renderCodeEmail("signUp", "<script>x</script>", CODE)
    expect(html).not.toContain("<script>")
    expect(html).toContain("Welcome, &lt;script&gt;x&lt;/script&gt;.")
  })

  it("says only Welcome when there is no name", () => {
    expect(renderCodeEmail("signUp", "", CODE).html).toContain("Welcome.")
    expect(renderCodeEmail("signUp", undefined, CODE).html).toContain("Welcome.")
  })

  // Cognito silently sends its own default email when a custom one is over 20,000 characters.
  it.each(KINDS)("%s: stays well under Cognito's 20,000-character limit, even for a 100-character name", (kind) => {
    const { html } = renderCodeEmail(kind, "&".repeat(100), CODE)
    expect(html.length).toBeLessThan(CODE_EMAIL_MAX_LENGTH)
  })
})
