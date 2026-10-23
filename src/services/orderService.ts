import { withTransaction } from "../lib/db"
import { ConflictError, ForbiddenError, NotFoundError, OrderRefusedError } from "../lib/errors"
import {
  cancelOrder,
  countPendingPieces,
  findCustomerOrders,
  findOrder,
  findOrderLines,
  insertOrder,
  lockCustomer,
  lockCustomerOrder,
  lockProducts,
  type OrderLineRow,
  type OrderRow,
} from "../models/orderModel"
import { findProductImages } from "../models/productImageModel"
import { ORDER_NOT_FOUND, type PlaceOrderInput } from "../schemas/order.schema"
import type { ProductImage } from "../types/catalog"
import type { Order, OrderSummary } from "../types/order"
import { NO_CUSTOMER_ROW } from "./customerService"

// All of a customer's pending orders together hold at most this many pieces (Rami, 2026-10-22: the scam cap).
export const MAX_PENDING_PIECES = 5

export const ORDER_REFUSALS = {
  limit: "For larger orders, please contact Omar.",
  gone: "One piece in your cart is no longer available.",
  soldOut: (name: string) => `${name} is sold out.`,
  fewLeft: (name: string, left: number) => `${name} has only ${left} left.`,
  priceChanged: (name: string) => `The price of ${name} has changed. Please check your cart.`,
  notFound: ORDER_NOT_FOUND,
  cannotCancel: "This order can no longer be cancelled. Please contact Omar.",
} as const

const cents = (amount: number) => Math.round(amount * 100)
const money = (amountInCents: number) => amountInCents / 100

// GS-0007. padStart never cuts a longer number (GS-12345).
export const orderNumber = (id: number) => `GS-${String(id).padStart(4, "0")}`

// Places the order in one transaction: the customer and the pieces are locked, every rule is checked, then the
// order, its lines and the stock change are written together. Anything refused = nothing saved.
export async function placeOrder(customerId: string, input: PlaceOrderInput): Promise<Order> {
  const items = [...input.items].sort((a, b) => a.productId - b.productId)
  const orderId = await withTransaction(async (client) => {
    if (!(await lockCustomer(client, customerId))) throw new ForbiddenError(NO_CUSTOMER_ROW)

    const pieces = items.reduce((sum, item) => sum + item.quantity, 0)
    if (pieces + (await countPendingPieces(client, customerId)) > MAX_PENDING_PIECES) {
      throw new OrderRefusedError("ORDER_LIMIT", ORDER_REFUSALS.limit)
    }

    const products = new Map((await lockProducts(client, items.map((i) => i.productId))).map((p) => [p.id, p]))
    for (const item of items) {
      const product = products.get(item.productId)
      if (!product || product.status !== "published") {
        throw new OrderRefusedError("UNAVAILABLE", ORDER_REFUSALS.gone, item.productId)
      }
      if (product.remaining === 0) {
        throw new OrderRefusedError("UNAVAILABLE", ORDER_REFUSALS.soldOut(product.name), item.productId)
      }
      if (product.remaining < item.quantity) {
        throw new OrderRefusedError("UNAVAILABLE", ORDER_REFUSALS.fewLeft(product.name, product.remaining), item.productId)
      }
      if (cents(product.price) !== cents(item.unitPrice)) {
        throw new OrderRefusedError("PRICE_CHANGED", ORDER_REFUSALS.priceChanged(product.name), item.productId)
      }
    }

    return insertOrder(client, {
      customerId,
      recipientName: input.recipient?.name ?? null,
      recipientPhone: input.recipient?.phone ?? null,
      city: input.city,
      address: input.address,
      deliveryNotes: input.deliveryNotes,
      isGift: input.isGift,
      giftMessage: input.giftMessage,
      // The price is the piece's own (equal to what the cart showed, checked above).
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: products.get(i.productId)!.price })),
    })
  })
  return getOrder(customerId, orderId)
}

// Each piece's cover photo (its first), by product id.
async function coverPhotos(lines: OrderLineRow[]): Promise<Map<number, ProductImage>> {
  const productIds = [...new Set(lines.map((l) => l.product_id))]
  const images = await findProductImages(productIds, 1)
  return new Map(images.map((i) => [i.product_id, { url: i.url, width: i.width, height: i.height }]))
}

const subtotalCents = (lines: OrderLineRow[]) => lines.reduce((sum, l) => sum + l.quantity * cents(l.unit_price), 0)

export async function listOrders(customerId: string): Promise<OrderSummary[]> {
  const orders = await findCustomerOrders(customerId)
  const lines = await findOrderLines(orders.map((o) => o.id))
  const covers = await coverPhotos(lines)
  return orders.map((order) => {
    const own = lines.filter((l) => l.order_id === order.id)
    return {
      id: order.id,
      number: orderNumber(order.id),
      status: order.status,
      createdAt: order.created_at.toISOString(),
      itemCount: own.reduce((sum, l) => sum + l.quantity, 0),
      total: money(subtotalCents(own) + cents(order.delivery_fee)),
      items: own.map((l) => ({ name: l.name, quantity: l.quantity })),
      image: own[0] ? (covers.get(own[0].product_id) ?? null) : null,
    }
  })
}

export async function getOrder(customerId: string, orderId: number): Promise<Order> {
  const order = await findOrder(orderId, customerId)
  if (!order) throw new NotFoundError(ORDER_REFUSALS.notFound)
  return buildOrder(order)
}

// The full order, as the customer sees it (the studio adds its own fields on top).
export async function buildOrder(order: OrderRow): Promise<Order> {
  const lines = await findOrderLines([order.id])
  const covers = await coverPhotos(lines)
  const subtotal = subtotalCents(lines)
  const isAccountHolder = order.recipient_name === null
  return {
    id: order.id,
    number: orderNumber(order.id),
    status: order.status,
    createdAt: order.created_at.toISOString(),
    items: lines.map((l) => ({
      productId: l.product_id,
      name: l.name,
      stoneType: l.stone_type,
      color: l.color,
      quantity: l.quantity,
      unitPrice: l.unit_price,
      lineTotal: money(l.quantity * cents(l.unit_price)),
      image: covers.get(l.product_id) ?? null,
    })),
    subtotal: money(subtotal),
    deliveryFee: order.delivery_fee,
    total: money(subtotal + cents(order.delivery_fee)),
    recipient: {
      name: isAccountHolder ? order.customer_name : order.recipient_name!,
      phone: isAccountHolder ? order.customer_phone : order.recipient_phone!,
      isAccountHolder,
    },
    city: order.city,
    address: order.address,
    deliveryNotes: order.delivery_notes,
    isGift: order.is_gift,
    giftMessage: order.gift_message,
    canCancel: order.status === "pending",
  }
}

// The customer cancels a pending order; its pieces go back in stock in the same transaction.
export async function cancelCustomerOrder(customerId: string, orderId: number): Promise<Order> {
  await withTransaction(async (client) => {
    const status = await lockCustomerOrder(client, customerId, orderId)
    if (status === null) throw new NotFoundError(ORDER_REFUSALS.notFound)
    if (status !== "pending") throw new ConflictError(ORDER_REFUSALS.cannotCancel)
    await cancelOrder(client, orderId)
  })
  return getOrder(customerId, orderId)
}
