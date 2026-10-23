import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { requireCustomer } from "../lib/auth"
import { getPathParam } from "../lib/request"
import { orderIdFromPath } from "../schemas/order.schema"
import { getOrder, listOrders } from "../services/orderService"
import { handleError, ok } from "../views/response"

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
