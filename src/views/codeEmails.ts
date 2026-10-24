import { CHARCOAL, emailShell, row, SANS, WINE } from "./emailLayout"

// The customer pool's code emails (Cognito's custom message trigger), in the order emails' design. Cognito puts the
// real code where `code` (its placeholder, "{####}") stands, and sends the HTML only (it has no text part).
// The shop calls it "the 6-digit code" everywhere, so the emails do too.

export type CodeEmailKind = "signUp" | "forgotPassword" | "newEmail"

// Cognito drops a longer custom email without an error and sends its own default one instead.
export const CODE_EMAIL_MAX_LENGTH = 20_000

const COPY: Record<CodeEmailKind, { subject: string; kicker: string; title: (first: string) => string; body: string; note: string }> = {
  signUp: {
    subject: "Your Glowstone sign-up code",
    kicker: "WELCOME",
    title: (first) => (first ? `Welcome, ${first}.` : "Welcome."),
    body: "Enter this 6-digit code on the Glowstone page to confirm your email and finish creating your account.",
    note: "The code works for 24 hours. If you didn't create a Glowstone account, you can ignore this email.",
  },
  forgotPassword: {
    subject: "Reset your Glowstone password",
    kicker: "PASSWORD RESET",
    title: () => "Reset your password.",
    body: "Enter this 6-digit code on the Glowstone page, with your new password.",
    note: "The code works for 1 hour. If you didn't ask to reset your password, you can ignore this email: your password stays the same.",
  },
  newEmail: {
    subject: "Confirm your new email",
    kicker: "NEW EMAIL",
    title: () => "Confirm your new email.",
    body: "Enter this 6-digit code on the Glowstone page to use this address for your account.",
    note: "The code works for 24 hours. If you didn't ask for this, you can ignore this email: your account keeps its current email.",
  },
}

// The code is in the sans font: the serif's old-style figures sit at uneven heights, harder to read and type.
const codeBox = (code: string) =>
  row(
    `<div style="display:inline-block; padding:18px 28px; border:1px solid ${WINE}; font-family:${SANS}; font-size:34px; letter-spacing:.3em; color:${CHARCOAL};">${code}</div>`,
    "28px 48px 0",
  )

// name = the account's name as typed (escaped by the layout); empty or missing = no first name in the greeting.
export function renderCodeEmail(kind: CodeEmailKind, name: string | undefined, code: string): { subject: string; html: string } {
  const copy = COPY[kind]
  const first = name?.trim().split(/\s+/)[0] ?? ""
  const html = emailShell({ ...copy, title: copy.title(first), middle: codeBox(code) })
  return { subject: copy.subject, html }
}
