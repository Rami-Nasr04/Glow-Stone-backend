// The design every Glowstone email shares (brief §6, the Emails prototype): a table layout up to 600 px wide that
// narrows on phones (Outlook on Windows ignores max-width, so it gets a fixed 600 px table of its own), inline
// styles, Georgia / Helvetica fallbacks, Frost Stone background, Charcoal text; Wine for the top bar, the dot in the name,
// the small label, the rule under the title and the button.

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

export const STONE = "#C9C8C4"
export const LIGHT_STONE = "#D4D3CF"
// The card is lighter than the page, not the prototype's darker Frost Stone: the Gmail phone app's dark mode
// flips light colours to dark and dark text to light, but leaves a mid grey like #C9C8C4 alone, which made the text
// unreadable on it. Tested on Rami's phone 2026-10-24: with both colours this light, page and card flip together.
export const CARD = "#E3E2DE"
export const CHARCOAL = "#2B2B2B"
export const MUTED = "#4D4C49"
export const WINE = "#5A2A32"
export const HAIRLINE = "#B5B4B0"
export const SANS = "'Jost', Helvetica, Arial, sans-serif"
export const SERIF = "'Cormorant Garamond', Georgia, serif"
export const CONTACT_EMAIL = "glowstone216@gmail.com"

// The name with a Wine dot between GLOW and STONE; the dot is hidden from screen readers so the name reads as one word.
export const WORDMARK = `GLOW<span aria-hidden="true" style="color:${WINE};">&bull;</span>STONE`

export const FOOTER_TEXT = `Made in Lebanon. Questions? Reply to this email or write to ${CONTACT_EMAIL}.`

// Customer text (names, addresses, card messages) is escaped before it goes into the HTML.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export const row = (content: string, padding = "22px 48px 0") => `<tr><td style="padding:${padding};">${content}</td></tr>`
export const sans = (content: string, size = 16, color = CHARCOAL, extra = "") =>
  `<div style="font-family:${SANS}; font-size:${size}px; line-height:1.7; color:${color};${extra}">${content}</div>`
export const label = (content: string) => sans(content, 12, MUTED, " letter-spacing:.24em;")

// The parts of one email. middle = what comes between the opening text and the button (an order, a code);
// without a button the email goes straight on to its note.
export interface EmailParts {
  subject: string
  kicker: string
  title: string
  body: string
  middle: string
  button?: { label: string; href: string }
  note: string
}

export function emailShell(parts: EmailParts): string {
  const button = parts.button
    ? row(
        `<a href="${escapeHtml(parts.button.href)}" style="display:inline-block; padding:14px 28px; background:${WINE}; color:${STONE}; font-family:${SANS}; font-size:12px; letter-spacing:.24em; text-decoration:none;">${parts.button.label} →</a>`,
        "32px 48px 0",
      )
    : ""
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(parts.subject)}</title></head>
<body style="margin:0; padding:0; background:${LIGHT_STONE};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${LIGHT_STONE};"><tr><td align="center" style="padding:24px 0;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; background:${CARD}; border-collapse:collapse;">
<tr><td height="6" bgcolor="${WINE}" style="height:6px; background:${WINE}; font-size:0; line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:34px 48px 28px; text-align:center; border-bottom:1px solid ${HAIRLINE}; font-family:${SERIF}; font-size:26px; letter-spacing:.32em; color:${CHARCOAL};">${WORDMARK}</td></tr>
${row(sans(parts.kicker, 12, WINE, " letter-spacing:.28em;"), "44px 48px 0")}
${row(`<div style="font-family:${SERIF}; font-weight:300; font-size:40px; line-height:1.15; color:${CHARCOAL};">${escapeHtml(parts.title)}</div>`, "14px 48px 0")}
${row(`<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="48" height="1" style="width:48px; height:1px; background:${WINE}; font-size:0; line-height:0;">&nbsp;</td></tr></table>`)}
${row(sans(escapeHtml(parts.body)))}
${parts.middle}
${button}
${row(sans(escapeHtml(parts.note), 14, MUTED), "24px 48px 40px")}
<tr><td style="padding:40px 48px; border-top:1px solid ${HAIRLINE};">${sans(`Made in Lebanon.<br>Questions? Reply to this email or write to <a href="mailto:${CONTACT_EMAIL}" style="color:${WINE};">${CONTACT_EMAIL}</a>.`, 12, MUTED)}</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`
}
