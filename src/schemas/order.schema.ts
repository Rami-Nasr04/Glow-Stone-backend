import { z } from "zod"
import { NotFoundError } from "../lib/errors"
import { phoneField } from "./customer.schema"

export const ORDER_NOT_FOUND = "Order not found"

export const ORDER_MESSAGES = {
  emptyCart: "Your cart is empty.",
  // A line the shop never sends (bad id, quantity or price): something is off in the cart, not in what the customer typed.
  badLine: "Please check your cart and try again.",
  pieceTwice: "Each piece can only be in the order once.",
  recipientName: "Please enter the recipient's name (up to 100 characters).",
  city: "Please enter the city (up to 100 characters).",
  address: "Please enter the address (up to 300 characters).",
  deliveryNotes: "Delivery notes can be up to 500 characters.",
  giftMessage: "The card message can be up to 200 characters.",
  giftOnly: "Card messages are only for gifts.",
} as const

const requiredText = (max: number, message: string) => z.string({ error: message }).trim().min(1, message).max(max, message)

// Trimmed; "" (or only spaces), null and left out all mean none, stored as null.
const optionalText = (max: number, message: string) =>
  z
    .string({ error: message })
    .trim()
    .max(max, message)
    .nullish()
    .transform((v) => v || null)

const badLine = { error: ORDER_MESSAGES.badLine }

const itemSchema = z.strictObject(
  {
    productId: z.number(badLine).int(badLine).positive(badLine),
    // The 5-piece limit is checked with the customer's other pending orders (ORDER_LIMIT); this only keeps numbers sane.
    quantity: z.number(badLine).int(badLine).min(1, badLine).max(100, badLine),
    // The price the cart showed; the order is refused if the piece's price has changed since.
    unitPrice: z.number(badLine).positive(badLine),
  },
  badLine,
)

// POST /orders. The same rules as the orders table (006_orders.sql), with the shop's messages.
export const placeOrderSchema = z
  .strictObject({
    items: z
      .array(itemSchema, badLine)
      .min(1, ORDER_MESSAGES.emptyCart)
      .max(20, badLine)
      .refine((items) => new Set(items.map((i) => i.productId)).size === items.length, ORDER_MESSAGES.pieceTwice),
    // null = the account holder receives it.
    recipient: z
      .strictObject({
        name: requiredText(100, ORDER_MESSAGES.recipientName),
        phone: phoneField,
      })
      .nullable()
      .default(null),
    city: requiredText(100, ORDER_MESSAGES.city),
    address: requiredText(300, ORDER_MESSAGES.address),
    deliveryNotes: optionalText(500, ORDER_MESSAGES.deliveryNotes),
    isGift: z.boolean().default(false),
    giftMessage: optionalText(200, ORDER_MESSAGES.giftMessage),
  })
  .refine((order) => order.giftMessage === null || order.isGift, { message: ORDER_MESSAGES.giftOnly, path: ["giftMessage"] })

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>

// An order id from the path. Anything that isn't one of ours (text, 0, too big for the column) is simply not found.
export function orderIdFromPath(raw: string | null): number {
  const id = raw !== null && /^\d{1,9}$/.test(raw) ? Number(raw) : 0
  if (id < 1) throw new NotFoundError(ORDER_NOT_FOUND)
  return id
}
