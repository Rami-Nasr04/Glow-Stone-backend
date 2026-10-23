import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { requireAdmin } from "../lib/auth"
import { NotFoundError } from "../lib/errors"
import { getPathParam, getQueryParam, parseBody } from "../lib/request"
import { CUSTOMER_ID, deliveryFeeSchema, orderStatusFilterSchema } from "../schemas/adminOrder.schema"
import { orderIdFromPath } from "../schemas/order.schema"
import {
  ADMIN_ORDER_MESSAGES,
  changeDeliveryFee,
  getAdminCustomer,
  getAdminOrder,
  listAdminCustomers,
  listAdminOrders,
} from "../services/adminOrderService"
import { handleError, ok } from "../views/response"

// GET /admin/orders (?status=pending): every order, newest first.
export const list = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    requireAdmin(event)
    const status = orderStatusFilterSchema.parse(getQueryParam(event, "status") ?? undefined)
    return ok(await listAdminOrders(status))
  } catch (err) {
    return handleError(err)
  }
}

// GET /admin/orders/{id}: the full order, its customer, and what can be done next.
export const get = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    requireAdmin(event)
    return ok(await getAdminOrder(orderIdFromPath(getPathParam(event, "id"))))
  } catch (err) {
    return handleError(err)
  }
}

// PATCH /admin/orders/{id}: the delivery fee, while pending.
export const update = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    requireAdmin(event)
    const id = orderIdFromPath(getPathParam(event, "id"))
    const { deliveryFee } = deliveryFeeSchema.parse(parseBody(event))
    return ok(await changeDeliveryFee(id, deliveryFee))
  } catch (err) {
    return handleError(err)
  }
}

// GET /admin/customers: every account, newest first, with order counts.
export const listCustomers = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    requireAdmin(event)
    return ok(await listAdminCustomers())
  } catch (err) {
    return handleError(err)
  }
}

// GET /admin/customers/{id}: one customer with their orders.
export const getCustomer = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    requireAdmin(event)
    const id = getPathParam(event, "id") ?? ""
    if (!CUSTOMER_ID.test(id)) throw new NotFoundError(ADMIN_ORDER_MESSAGES.customerNotFound)
    return ok(await getAdminCustomer(id))
  } catch (err) {
    return handleError(err)
  }
}
