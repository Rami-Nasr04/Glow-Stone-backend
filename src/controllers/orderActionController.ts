import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { requireAdmin, requireCustomer } from "../lib/auth"
import { callOrdersDb } from "../lib/ordersDb"
import { getPathParam, parseBody } from "../lib/request"
import { advanceOrderSchema } from "../schemas/adminOrder.schema"
import { orderIdFromPath, placeOrderSchema } from "../schemas/order.schema"
import { notifyOrderPlaced, notifyOrderStatus } from "../services/orderNotificationService"
import { handleError, ok } from "../views/response"

// The order routes that send emails. They run OUTSIDE the VPC (SES and Cognito need the internet): the token and the
// body are checked here, the database part runs in the private ordersDb function, and the emails go after it commits.

// POST /orders: 201 with the order; the customer gets "order received" and every admin the new-order alert.
// A repeat (the same requestId sent again) answers the same 201 and emails nobody: the first one already did.
export const place = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const { sub } = requireCustomer(event)
    const input = placeOrderSchema.parse(parseBody(event))
    const result = await callOrdersDb({ op: "place", customerId: sub, input })
    if (!result.ok) return result.response
    if (!result.data.repeat) await notifyOrderPlaced(result.data.admin)
    return ok(result.data.order, 201)
  } catch (err) {
    return handleError(err)
  }
}

// POST /me/orders/{id}/cancel: a pending order; the customer gets "cancelled".
export const cancel = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const { sub } = requireCustomer(event)
    const orderId = orderIdFromPath(getPathParam(event, "id"))
    const result = await callOrdersDb({ op: "customerCancel", customerId: sub, orderId })
    if (!result.ok) return result.response
    await notifyOrderStatus("cancelled", result.data.admin)
    return ok(result.data.order)
  } catch (err) {
    return handleError(err)
  }
}

// POST /admin/orders/{id}/status: one step forward; the customer gets that step's email.
export const adminAdvance = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    requireAdmin(event)
    const orderId = orderIdFromPath(getPathParam(event, "id"))
    const { status } = advanceOrderSchema.parse(parseBody(event))
    const result = await callOrdersDb({ op: "advance", orderId, status })
    if (!result.ok) return result.response
    await notifyOrderStatus(status, result.data.admin)
    return ok(result.data.admin)
  } catch (err) {
    return handleError(err)
  }
}

// POST /admin/orders/{id}/cancel: any order before delivery; the customer gets "cancelled".
export const adminCancel = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    requireAdmin(event)
    const orderId = orderIdFromPath(getPathParam(event, "id"))
    const result = await callOrdersDb({ op: "adminCancel", orderId })
    if (!result.ok) return result.response
    await notifyOrderStatus("cancelled", result.data.admin)
    return ok(result.data.admin)
  } catch (err) {
    return handleError(err)
  }
}
