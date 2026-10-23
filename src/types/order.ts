import type { ProductImage } from "./catalog"

export type OrderStatus = "pending" | "confirmed" | "out_for_delivery" | "delivered" | "cancelled"

// GET /me/orders: one row of the customer's list.
export interface OrderSummary {
  id: number
  number: string
  status: OrderStatus
  createdAt: string
  itemCount: number
  total: number
  items: { name: string; quantity: number }[]
  image: ProductImage | null
}

export interface OrderLine {
  productId: number
  name: string
  stoneType: string
  color: string
  quantity: number
  unitPrice: number
  lineTotal: number
  image: ProductImage | null
}

// GET /me/orders/{id}, and the answer to placing or cancelling an order.
export interface Order {
  id: number
  number: string
  status: OrderStatus
  createdAt: string
  items: OrderLine[]
  subtotal: number
  deliveryFee: number
  total: number
  recipient: { name: string; phone: string; isAccountHolder: boolean }
  city: string
  address: string
  deliveryNotes: string | null
  isGift: boolean
  giftMessage: string | null
  canCancel: boolean
}
