import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda"
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import type { PlaceOrderInput } from "../schemas/order.schema"
import type { AdminOrder, Order } from "../types/order"
import { requiredEnv } from "./env"

// The order routes that send emails run outside the VPC (it has no internet, so no SES or Cognito from inside).
// They call the private in-VPC `ordersDb` function for the database part, then send the emails themselves.

export type OrdersDbRequest =
  | { op: "place"; customerId: string; input: PlaceOrderInput }
  | { op: "customerCancel"; customerId: string; orderId: number }
  | { op: "advance"; orderId: number; status: "confirmed" | "out_for_delivery" | "delivered" }
  | { op: "adminCancel"; orderId: number }

// order = what the caller answers with (the customer's view for customer routes); admin = the studio's view, which
// also carries the customer's email and name for the emails.
export interface OrdersDbData {
  order: Order
  admin: AdminOrder
}

// A refusal comes back as the exact API answer (the database side ran it through handleError), so the route
// returns it unchanged.
export type OrdersDbResult = { ok: true; data: OrdersDbData } | { ok: false; response: APIGatewayProxyStructuredResultV2 }

let lambda: LambdaClient | undefined

export async function callOrdersDb(request: OrdersDbRequest): Promise<OrdersDbResult> {
  lambda ??= new LambdaClient({})
  const res = await lambda.send(
    new InvokeCommand({
      FunctionName: requiredEnv("ORDERS_DB_FUNCTION"),
      InvocationType: "RequestResponse",
      Payload: Buffer.from(JSON.stringify(request)),
    }),
  )
  const text = res.Payload ? Buffer.from(res.Payload).toString("utf-8") : ""
  if (res.FunctionError) throw new Error(`ordersDb failed (${res.FunctionError}): ${text.slice(0, 300)}`)
  const parsed = JSON.parse(text) as OrdersDbResult
  if (typeof parsed?.ok !== "boolean") throw new Error(`ordersDb answered something unexpected: ${text.slice(0, 300)}`)
  return parsed
}
