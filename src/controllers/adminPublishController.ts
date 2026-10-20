import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { requireAdmin } from "../lib/auth"
import { publishSite } from "../services/publishService"
import { handleError, ok } from "../views/response"

// POST /admin/publish: rebuilds the shop from the current pieces (about 2 minutes). 202 = Vercel took it.
export const publish = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    requireAdmin(event)
    await publishSite()
    return ok({ started: true }, 202)
  } catch (err) {
    return handleError(err)
  }
}
