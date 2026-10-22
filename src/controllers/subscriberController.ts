import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { parseBody } from "../lib/request"
import { subscribeSchema } from "../schemas/subscriber.schema"
import { subscribe } from "../services/subscriberService"
import { handleError } from "../views/response"

// POST /subscribers: joins the news list. Always 204 once the email is valid, whether it was new, already there
// or caught by the trap, so nobody can use it to find out who is on the list.
export const create = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    await subscribe(subscribeSchema.parse(parseBody(event)))
    return { statusCode: 204 }
  } catch (err) {
    return handleError(err)
  }
}
