import { withTransaction } from "../lib/db"
import { ConflictError, NotFoundError } from "../lib/errors"
import { findAdminCustomers } from "../models/customerModel"
import {
  cancelOrder,
  findAdminOrders,
  findOrder,
  lockOrder,
  setDeliveryFee,
  setOrderStatus,
  type AdminOrderListRow,
} from "../models/orderModel"
import type { AdminCustomer, AdminCustomerDetail, AdminOrder, AdminOrderSummary, OrderStatus } from "../types/order"
import { buildOrder, ORDER_REFUSALS, orderNumber } from "./orderService"

type ForwardStatus = "confirmed" | "out_for_delivery" | "delivered"

// The one step forward from each status (Omar confirms after his call); null = the order is finished.
const NEXT_STATUS: Record<OrderStatus, ForwardStatus | null> = {
  pending: "confirmed",
  confirmed: "out_for_delivery",
  out_for_delivery: "delivered",
  delivered: null,
  cancelled: null,
}

const FLOW: OrderStatus[] = ["pending", "confirmed", "out_for_delivery", "delivered"]

const LABEL: Record<ForwardStatus, string> = {
  confirmed: "confirmed",
  out_for_delivery: "out for delivery",
  delivered: "delivered",
}

// The step that has to happen first, for a request that skips one.
const DO_FIRST: Record<ForwardStatus, string> = {
  confirmed: "Confirm the order first.",
  out_for_delivery: "Send the order out for delivery first.",
  delivered: "Mark the order delivered first.",
}

export const ADMIN_ORDER_MESSAGES = {
  wasCancelled: "This order was cancelled.",
  already: (status: ForwardStatus) => `This order is already ${LABEL[status]}.`,
  deliveredNoCancel: "A delivered order can't be cancelled.",
  alreadyCancelled: "This order is already cancelled.",
  feeOnlyPending: "The delivery fee can only change before the order is confirmed.",
  customerNotFound: "Customer not found",
} as const

const cents = (amount: number) => Math.round(amount * 100)

function summary(row: AdminOrderListRow): AdminOrderSummary {
  return {
    id: row.id,
    number: orderNumber(row.id),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    customer: { id: row.customer_id, name: row.customer_name, phone: row.customer_phone },
    city: row.city,
    itemCount: row.item_count,
    total: (cents(row.subtotal) + cents(row.delivery_fee)) / 100,
    isGift: row.is_gift,
  }
}

export async function listAdminOrders(status?: OrderStatus): Promise<AdminOrderSummary[]> {
  return (await findAdminOrders({ status })).map(summary)
}

export async function getAdminOrder(orderId: number): Promise<AdminOrder> {
  const order = await findOrder(orderId)
  if (!order) throw new NotFoundError(ORDER_REFUSALS.notFound)
  const base = await buildOrder(order)
  return {
    ...base,
    customer: { id: order.customer_id, email: order.customer_email, name: order.customer_name, phone: order.customer_phone },
    nextStatus: NEXT_STATUS[order.status],
    // Omar may cancel any order not yet delivered (the customer only a pending one).
    canCancel: order.status !== "delivered" && order.status !== "cancelled",
    canEditFee: order.status === "pending",
  }
}

// Moves the order one step forward. A request for any other step explains what's wrong (e.g. a second tab).
export async function advanceOrder(orderId: number, status: ForwardStatus): Promise<AdminOrder> {
  await withTransaction(async (client) => {
    const current = await lockOrder(client, orderId)
    if (current === null) throw new NotFoundError(ORDER_REFUSALS.notFound)
    if (current === "cancelled") throw new ConflictError(ADMIN_ORDER_MESSAGES.wasCancelled)
    const next = NEXT_STATUS[current]
    if (next !== status) {
      if (FLOW.indexOf(current) >= FLOW.indexOf(status)) throw new ConflictError(ADMIN_ORDER_MESSAGES.already(status))
      throw new ConflictError(DO_FIRST[next!])
    }
    await setOrderStatus(client, orderId, status)
  })
  return getAdminOrder(orderId)
}

// Cancels any order before delivery; its pieces go back in stock in the same transaction.
export async function cancelAdminOrder(orderId: number): Promise<AdminOrder> {
  await withTransaction(async (client) => {
    const current = await lockOrder(client, orderId)
    if (current === null) throw new NotFoundError(ORDER_REFUSALS.notFound)
    if (current === "delivered") throw new ConflictError(ADMIN_ORDER_MESSAGES.deliveredNoCancel)
    if (current === "cancelled") throw new ConflictError(ADMIN_ORDER_MESSAGES.alreadyCancelled)
    await cancelOrder(client, orderId)
  })
  return getAdminOrder(orderId)
}

// The fee Omar agreed on his confirmation call, only while the order is pending.
export async function changeDeliveryFee(orderId: number, fee: number): Promise<AdminOrder> {
  await withTransaction(async (client) => {
    const current = await lockOrder(client, orderId)
    if (current === null) throw new NotFoundError(ORDER_REFUSALS.notFound)
    if (current !== "pending") throw new ConflictError(ADMIN_ORDER_MESSAGES.feeOnlyPending)
    await setDeliveryFee(client, orderId, fee)
  })
  return getAdminOrder(orderId)
}

export async function listAdminCustomers(): Promise<AdminCustomer[]> {
  return (await findAdminCustomers()).map((c) => ({
    id: c.id,
    email: c.email,
    name: c.name,
    phone: c.phone,
    createdAt: c.created_at.toISOString(),
    orderCount: c.order_count,
  }))
}

export async function getAdminCustomer(customerId: string): Promise<AdminCustomerDetail> {
  const [customer] = await findAdminCustomers(customerId)
  if (!customer) throw new NotFoundError(ADMIN_ORDER_MESSAGES.customerNotFound)
  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    createdAt: customer.created_at.toISOString(),
    orders: (await findAdminOrders({ customerId })).map(summary),
  }
}
