import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { requireCustomer } from "../lib/auth"
import { getMe } from "../services/customerService"
import { handleError, ok } from "../views/response"

// GET /me: the signed-in customer's email, name and phone.
export const me = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const { sub } = requireCustomer(event)
    return ok(await getMe(sub))
  } catch (err) {
    return handleError(err)
  }
}
