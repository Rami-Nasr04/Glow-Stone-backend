import type { PoolClient } from "pg"
import { executeQuery } from "../lib/db"
import type { OrderStatus } from "../types/order"

export interface OrderRow {
  id: number
  status: OrderStatus
  created_at: Date
  delivery_fee: number
  recipient_name: string | null
  recipient_phone: string | null
  city: string
  address: string
  delivery_notes: string | null
  is_gift: boolean
  gift_message: string | null
  // The account holder's, for an order they receive themselves.
  customer_name: string
  customer_phone: string
}

export interface OrderListRow {
  id: number
  status: OrderStatus
  created_at: Date
  delivery_fee: number
}

export interface OrderLineRow {
  order_id: number
  product_id: number
  quantity: number
  unit_price: number
  name: string
  stone_type: string
  color: string
}

export interface StockRow {
  id: number
  name: string
  price: number
  status: "draft" | "published"
  remaining: number
}

export interface NewOrder {
  customerId: string
  recipientName: string | null
  recipientPhone: string | null
  city: string
  address: string
  deliveryNotes: string | null
  isGift: boolean
  giftMessage: string | null
  items: { productId: number; quantity: number; unitPrice: number }[]
}

// ---- Placing an order: every step runs on the same transaction's connection. ----

// Locks the customer's row so two orders from the same account are placed one after the other (the 5-piece limit
// counts the other pending orders). false = no customers row.
export async function lockCustomer(client: PoolClient, customerId: string): Promise<boolean> {
  const { rowCount } = await client.query("select 1 from customers where id = $1 for update", [customerId])
  return rowCount === 1
}

// Pieces in the customer's pending orders.
export async function countPendingPieces(client: PoolClient, customerId: string): Promise<number> {
  const { rows } = await client.query<{ pieces: number }>(
    `select coalesce(sum(oi.quantity), 0)::int as pieces
     from orders o join order_items oi on oi.order_id = o.id
     where o.customer_id = $1 and o.status = 'pending'`,
    [customerId],
  )
  return rows[0].pieces
}

// Locks the pieces being ordered (always in id order, so two orders never wait on each other in a circle).
// A missing id simply has no row.
export async function lockProducts(client: PoolClient, productIds: number[]): Promise<StockRow[]> {
  const { rows } = await client.query<StockRow>(
    "select id, name, price, status, remaining from products where id = any($1::int[]) order by id for update",
    [productIds],
  )
  return rows
}

export async function insertOrder(client: PoolClient, order: NewOrder): Promise<number> {
  const { rows } = await client.query<{ id: number }>(
    `insert into orders (customer_id, recipient_name, recipient_phone, city, address, delivery_notes, is_gift, gift_message)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [
      order.customerId,
      order.recipientName,
      order.recipientPhone,
      order.city,
      order.address,
      order.deliveryNotes,
      order.isGift,
      order.giftMessage,
    ],
  )
  const orderId = rows[0].id
  await client.query(
    `insert into order_items (order_id, product_id, quantity, unit_price)
     select $1::int, * from unnest($2::int[], $3::int[], $4::numeric[])`,
    [orderId, order.items.map((i) => i.productId), order.items.map((i) => i.quantity), order.items.map((i) => i.unitPrice)],
  )
  await client.query(
    `update products p set remaining = p.remaining - taken.quantity
     from unnest($1::int[], $2::int[]) as taken (product_id, quantity)
     where p.id = taken.product_id`,
    [order.items.map((i) => i.productId), order.items.map((i) => i.quantity)],
  )
  return orderId
}

// ---- Cancelling ----

// Locks one of the customer's orders; null = not theirs or no such order.
export async function lockCustomerOrder(client: PoolClient, customerId: string, orderId: number): Promise<OrderStatus | null> {
  const { rows } = await client.query<{ status: OrderStatus }>(
    "select status from orders where id = $1 and customer_id = $2 for update",
    [orderId, customerId],
  )
  return rows[0]?.status ?? null
}

// Cancels the order and puts its pieces back. If Omar has lowered a piece's edition size since, the stock stops at it.
export async function cancelOrder(client: PoolClient, orderId: number): Promise<void> {
  await client.query("update orders set status = 'cancelled' where id = $1", [orderId])
  await client.query(
    `update products p set remaining = least(p.remaining + oi.quantity, p.edition_size)
     from order_items oi
     where oi.order_id = $1 and p.id = oi.product_id`,
    [orderId],
  )
}

// ---- Reading ----

export async function findCustomerOrders(customerId: string): Promise<OrderListRow[]> {
  return executeQuery<OrderListRow>(
    "select id, status, created_at, delivery_fee from orders where customer_id = $1 order by created_at desc, id desc",
    [customerId],
  )
}

export async function findCustomerOrder(customerId: string, orderId: number): Promise<OrderRow | null> {
  const rows = await executeQuery<OrderRow>(
    `select o.id, o.status, o.created_at, o.delivery_fee, o.recipient_name, o.recipient_phone, o.city, o.address,
            o.delivery_notes, o.is_gift, o.gift_message, c.name as customer_name, c.phone as customer_phone
     from orders o join customers c on c.id = o.customer_id
     where o.id = $1 and o.customer_id = $2`,
    [orderId, customerId],
  )
  return rows[0] ?? null
}

// The lines of several orders in one query, each order's in product id order, with the pieces' current names.
export async function findOrderLines(orderIds: number[]): Promise<OrderLineRow[]> {
  if (orderIds.length === 0) return []
  return executeQuery<OrderLineRow>(
    `select oi.order_id, oi.product_id, oi.quantity, oi.unit_price, p.name, p.stone_type, p.color
     from order_items oi join products p on p.id = oi.product_id
     where oi.order_id = any($1::int[])
     order by oi.order_id, oi.product_id`,
    [orderIds],
  )
}
