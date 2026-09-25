import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { ok } from "../views/response"

export const health = async (): Promise<APIGatewayProxyStructuredResultV2> => {
  return ok({ status: "ok", service: "Glow-Stone-backend", time: new Date().toISOString() })
}
