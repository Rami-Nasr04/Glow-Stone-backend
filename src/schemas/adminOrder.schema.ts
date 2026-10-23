import { z } from "zod"

export const ORDER_STATUSES = ["pending", "confirmed", "out_for_delivery", "delivered", "cancelled"] as const

// GET /admin/orders?status=…
export const orderStatusFilterSchema = z.enum(ORDER_STATUSES, { error: "Unknown order status." }).optional()

// POST /admin/orders/{id}/status: only the forward steps; cancelling has its own route.
export const advanceOrderSchema = z.strictObject({
  status: z.enum(["confirmed", "out_for_delivery", "delivered"], { error: "Choose confirmed, out for delivery or delivered." }),
})

const BAD_FEE = "The delivery fee must be between 0 and 10,000, with at most 2 decimals."

// PATCH /admin/orders/{id}: the fee Omar agreed on his call.
export const deliveryFeeSchema = z.strictObject({
  deliveryFee: z
    .number({ error: BAD_FEE })
    .min(0, BAD_FEE)
    .max(10_000, BAD_FEE)
    .refine((fee) => Math.abs(fee * 100 - Math.round(fee * 100)) < 1e-6, BAD_FEE),
})

// A customer id is a Cognito sub (a uuid); anything else can't be a customer.
export const CUSTOMER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
