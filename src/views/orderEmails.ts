import type { AdminOrder, Order, OrderStatus } from "../types/order"
import {
  CHARCOAL,
  emailShell,
  escapeHtml,
  FOOTER_TEXT,
  HAIRLINE,
  label,
  MUTED,
  row,
  sans,
  SERIF,
  type RenderedEmail,
} from "./emailLayout"

// The order emails, in the shared design (emailLayout.ts). Every email also has a plain-text part.
// Wording follows the prototype, with Omar's timings (2026-10-26): he calls within 2 business days, delivery takes about
// a week, and the courier calls or WhatsApps the recipient's phone. A gift is paid by the buyer, by Whish or OMT,
// once Omar has called and confirmed it; the recipient pays nothing.

export type CustomerEmailKind = Exclude<OrderStatus, "pending"> | "received"

// $890 · $1,200.50: cents only when there are some (as the shop shows prices).
export function formatMoney(amount: number): string {
  const whole = Number.isInteger(amount)
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`
}

// +961 71 234 567 · +961 3 123 456 (as the shop shows phones).
export function formatPhone(e164: string): string {
  const digits = e164.replace(/^\+961/, "")
  const local = digits.length === 8 ? `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}` : `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4)}`
  return `+961 ${local}`
}

const firstName = (name: string) => name.split(/\s+/)[0]

// The courier gets in touch with whoever receives the piece, on the phone given with the order.
const courier = (order: Order) =>
  `The courier will call or WhatsApp ${order.recipient.isAccountHolder ? "you" : order.recipient.name} on ${formatPhone(order.recipient.phone)} before coming.`

interface Copy {
  subject: string
  kicker: string
  title: string
  body: string
  showItems: boolean
  showTips: boolean
  button: { label: string; href: string }
  note: string
}

function customerCopy(kind: CustomerEmailKind, order: Order, name: string, siteUrl: string): Copy {
  const orderPage = { label: "VIEW YOUR ORDER", href: `${siteUrl}/account/orders/${order.id}` }
  const collection = { label: "VIEW THE COLLECTION", href: `${siteUrl}/collection` }
  const n = order.number
  switch (kind) {
    case "received":
      return {
        subject: `We've received your order ${n}`,
        kicker: "ORDER RECEIVED",
        title: `Thank you, ${firstName(name)}.`,
        body: order.isGift
          ? "We've received your order. Omar will call you within 2 business days to confirm it. You then pay by Whish or OMT. The recipient pays nothing."
          : "We've received your order. Omar will call you within 2 business days to confirm it. Nothing is due until your piece arrives.",
        showItems: true,
        showTips: false,
        button: orderPage,
        note: `${order.isGift ? "You pay, not the recipient: by Whish or OMT, once Omar has confirmed your order." : "Payment is cash on delivery."} Delivery is free; for far-off areas Omar may agree a delivery fee with you on his call.`,
      }
    case "confirmed":
      return {
        subject: `Your order ${n} is confirmed`,
        kicker: "ORDER CONFIRMED",
        title: "Your order is confirmed.",
        body: `Thank you for speaking with Omar. Your order is being prepared. Delivery usually takes about a week.${order.isGift ? " If you haven't yet, please send the payment by Whish or OMT, as agreed on the call." : ""}`,
        showItems: true,
        showTips: false,
        button: orderPage,
        note: "We'll write again when your pieces leave the workshop.",
      }
    case "out_for_delivery":
      return {
        subject: "Your piece is on its way",
        kicker: "OUT FOR DELIVERY",
        title: "Your piece is on its way.",
        body: order.isGift
          ? `Your order ${n} left the workshop today. ${courier(order)} The recipient pays nothing at the door.`
          : `Your order ${n} left the workshop today. ${courier(order)} Please have ${formatMoney(order.total)} ready in cash for the delivery.`,
        showItems: true,
        showTips: false,
        button: orderPage,
        note: "Each piece is heavy. Please make sure someone can receive it and show where it should stand.",
      }
    case "delivered":
      return {
        subject: "Delivered, thank you",
        kicker: "DELIVERED",
        title: "Thank you.",
        body: "Your pieces have arrived. We hope they keep you company for a long time. Natural variations in the stone are part of each one's character, and it will change a little with touch and time.",
        showItems: false,
        showTips: true,
        button: collection,
        note: "If something isn't right, reply to this email and Omar will be in touch.",
      }
    case "cancelled":
      return {
        subject: `Your order ${n} has been cancelled`,
        kicker: "ORDER CANCELLED",
        title: "Your order has been cancelled.",
        body: `Order ${n} has been cancelled and nothing was charged. If this wasn't what you expected, reply to this email and we'll help.`,
        showItems: false,
        showTips: false,
        button: collection,
        note: "The pieces have been returned to their editions.",
      }
  }
}

const TIPS = [
  "Dust with a soft, dry cloth.",
  "Limestone is porous: wipe spilled wine promptly and avoid acidic cleaners.",
  "Lift with two people. Never drag the stone across the floor.",
]

function itemsHtml(order: Order): string {
  const lines = order.items
    .map((item) => {
      const photo = item.image
        ? `<img src="${escapeHtml(item.image.url)}/480.webp" width="64" alt="" style="display:block; width:64px; height:auto; border:0;">`
        : ""
      const meta = escapeHtml(`${item.stoneType} · ${item.color} · QTY ${item.quantity}`.toUpperCase())
      return `<tr>
<td width="64" style="width:64px; padding:16px 0; vertical-align:top; border-bottom:1px solid ${HAIRLINE};">${photo}</td>
<td style="padding:16px 12px 16px 16px; vertical-align:top; border-bottom:1px solid ${HAIRLINE};"><div style="font-family:${SERIF}; font-size:22px; color:${CHARCOAL};">${escapeHtml(item.name)}</div>${sans(meta, 12, MUTED, " letter-spacing:.16em; padding-top:4px;")}</td>
<td width="96" style="width:96px; padding:16px 0; vertical-align:top; text-align:right; border-bottom:1px solid ${HAIRLINE};">${sans(formatMoney(item.lineTotal), 14)}</td>
</tr>`
    })
    .join("")
  const fee = order.deliveryFee === 0 ? "Free" : formatMoney(order.deliveryFee)
  const recipient = `${escapeHtml(order.recipient.name)} · ${formatPhone(order.recipient.phone)}`
  const gift = order.isGift
    ? `<br><br>${label("GIFT")}${order.giftMessage ? sans(`“${escapeHtml(order.giftMessage)}”`, 14) : ""}`
    : ""
  return [
    row(label(`ORDER ${order.number}`), "28px 48px 0"),
    row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">${lines}</table>`, "0 48px"),
    row(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr><td>${sans(`Delivery: ${fee}`, 14, MUTED)}</td><td style="text-align:right;">${sans(`Total ${formatMoney(order.total)}`, 16, CHARCOAL, " font-weight:500;")}</td></tr></table>`,
      "16px 48px 0",
    ),
    row(
      `${label("DELIVER TO")}${sans(`${recipient}<br>${escapeHtml(order.address)}, ${escapeHtml(order.city)}${order.deliveryNotes ? `<br>${escapeHtml(order.deliveryNotes)}` : ""}`, 14)}${gift}`,
      "20px 48px 0",
    ),
  ].join("")
}

function tipsHtml(): string {
  const tips = TIPS.map((tip, i) => sans(`0${i + 1}&nbsp;&nbsp;&nbsp;${tip}`, 14)).join("")
  return row(`${label("CARING FOR YOUR PIECE")}${tips}`, "28px 48px 0")
}

// A gift is paid by the buyer by Whish or OMT; the rest in cash at the door. who = the reader: the admins' alert
// also says who pays.
function itemsText(order: Order, who: "customer" | "admin"): string {
  const giftPayment = who === "customer" ? "by Whish or OMT" : "Whish or OMT, from the buyer"
  const lines = order.items.map((i) => `- ${i.name} (${i.stoneType} · ${i.color}) x ${i.quantity}: ${formatMoney(i.lineTotal)}`)
  const fee = order.deliveryFee === 0 ? "Free" : formatMoney(order.deliveryFee)
  return [
    `Order ${order.number}`,
    ...lines,
    `Delivery: ${fee}`,
    `Total: ${formatMoney(order.total)} (${order.isGift ? giftPayment : "cash on delivery"})`,
    "",
    "Deliver to:",
    `${order.recipient.name} · ${formatPhone(order.recipient.phone)}`,
    `${order.address}, ${order.city}`,
    ...(order.deliveryNotes ? [order.deliveryNotes] : []),
    ...(order.isGift ? ["", `Gift${order.giftMessage ? `: "${order.giftMessage}"` : ""}`] : []),
  ].join("\n")
}

// One of the customer's emails for an order: received (with the receipt), confirmed (the final receipt, with any fee
// Omar agreed), out for delivery, delivered, cancelled. name = the account holder's (they placed the order).
export function renderCustomerEmail(kind: CustomerEmailKind, order: Order, name: string, siteUrl: string): RenderedEmail {
  const copy = customerCopy(kind, order, name, siteUrl)
  const middle = (copy.showItems ? itemsHtml(order) : "") + (copy.showTips ? tipsHtml() : "")
  const text = [
    copy.title,
    "",
    copy.body,
    ...(copy.showItems ? ["", itemsText(order, "customer")] : []),
    ...(copy.showTips ? ["", "Caring for your piece:", ...TIPS.map((t, i) => `0${i + 1} ${t}`)] : []),
    "",
    `${copy.button.label[0]}${copy.button.label.slice(1).toLowerCase()}: ${copy.button.href}`,
    "",
    copy.note,
    "",
    FOOTER_TEXT,
  ].join("\n")
  return { subject: copy.subject, html: emailShell({ ...copy, middle }), text }
}

// The "new order" alert to every enabled admin: what Omar needs to make his call, and a link to the order in the studio.
export function renderNewOrderAlert(order: AdminOrder, studioUrl: string): RenderedEmail {
  const copy: Copy = {
    subject: `New order ${order.number} · ${order.customer.name} · ${formatMoney(order.total)}`,
    kicker: "NEW ORDER",
    title: `${order.number}`,
    body: `${order.customer.name} (${formatPhone(order.customer.phone)}, ${order.customer.email}) placed an order. Call to confirm it.`,
    showItems: true,
    showTips: false,
    button: { label: "OPEN IN THE STUDIO", href: `${studioUrl}/orders/${order.id}` },
    note: "This alert goes to every admin of the studio.",
  }
  const text = [copy.body, "", itemsText(order, "admin"), "", `Open in the studio: ${copy.button.href}`].join("\n")
  return { subject: copy.subject, html: emailShell({ ...copy, middle: itemsHtml(order) }), text }
}
