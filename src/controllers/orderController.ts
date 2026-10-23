import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { requireCustomer } from "../lib/auth"
import { getPathParam, parseBody } from "../lib/request"
import { orderIdFromPath, placeOrderSchema } from "../schemas/order.schema"
import { cancelCustomerOrder, getOrder, listOrders, placeOrder } from "../services/orderService"
import { handleError, ok } from "../views/response"

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
    return ok(await getOrder(sub, orderIdFromPath(getPathParam(event, "id"))))
  } catch (err) {
    return handleError(err)
  }
}

// POST /me/orders/{id}/cancel
export const cancel = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const { sub } = requireCustomer(event)
    return ok(await cancelCustomerOrder(sub, orderIdFromPath(getPathParam(event, "id"))))
  } catch (err) {
    return handleError(err)
  }
}
