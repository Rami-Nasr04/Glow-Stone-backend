import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { requireCustomer } from "../lib/auth"
import { NotFoundError } from "../lib/errors"
import { getPathParam, parseBody } from "../lib/request"
import { placeOrderSchema } from "../schemas/order.schema"
import { cancelCustomerOrder, getOrder, listOrders, ORDER_REFUSALS, placeOrder } from "../services/orderService"
import { handleError, ok } from "../views/response"

// An order id from the path. Anything that isn't one of ours (text, 0, too big for the column) is simply not found.
function orderId(event: APIGatewayProxyEventV2): number {
  const raw = getPathParam(event, "id") ?? ""
  const id = /^\d{1,9}$/.test(raw) ? Number(raw) : 0
  if (id < 1) throw new NotFoundError(ORDER_REFUSALS.notFound)
  return id
}

// POST /orders: 201 with the full order.
export const place = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const { sub } = requireCustomer(event)
    return ok(await placeOrder(sub, placeOrderSchema.parse(parseBody(event))), 201)
  } catch (err) {
    return handleError(err)
  }
}

// GET /me/orders
export const list = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const { sub } = requireCustomer(event)
    return ok(await listOrders(sub))
  } catch (err) {
    return handleError(err)
  }
}

// GET /me/orders/{id}
export const get = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const { sub } = requireCustomer(event)
    return ok(await getOrder(sub, orderId(event)))
  } catch (err) {
    return handleError(err)
  }
}

// POST /me/orders/{id}/cancel
export const cancel = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const { sub } = requireCustomer(event)
    return ok(await cancelCustomerOrder(sub, orderId(event)))
  } catch (err) {
    return handleError(err)
  }
}
