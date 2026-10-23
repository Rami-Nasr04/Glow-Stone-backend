import type { OrdersDbRequest, OrdersDbResult } from "../lib/ordersDb"
import { advanceOrder, cancelAdminOrder, getAdminOrder } from "../services/adminOrderService"
import { cancelCustomerOrder, placeOrder } from "../services/orderService"
import { handleError } from "../views/response"

// The private in-VPC orders function (no HTTP route; only the order routes outside the VPC may invoke it).
// Callers have already checked the token and the body. Every refusal is answered as the API answer it becomes.
export const run = async (request: OrdersDbRequest): Promise<OrdersDbResult> => {
  try {
    switch (request.op) {
      case "place": {
        const order = await placeOrder(request.customerId, request.input)
        return { ok: true, data: { order, admin: await getAdminOrder(order.id) } }
      }
      case "customerCancel": {
        const order = await cancelCustomerOrder(request.customerId, request.orderId)
        return { ok: true, data: { order, admin: await getAdminOrder(order.id) } }
      }
      case "advance": {
        const admin = await advanceOrder(request.orderId, request.status)
        return { ok: true, data: { order: admin, admin } }
      }
      case "adminCancel": {
        const admin = await cancelAdminOrder(request.orderId)
        return { ok: true, data: { order: admin, admin } }
      }
      default:
        throw new Error(`Unknown ordersDb op: ${(request as { op?: unknown }).op}`)
    }
  } catch (err) {
    return { ok: false, response: handleError(err) }
  }
}
