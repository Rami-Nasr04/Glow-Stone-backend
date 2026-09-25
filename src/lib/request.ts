import type { APIGatewayProxyEventV2 } from "aws-lambda"
import { InvalidBodyError } from "./errors"

export function parseBody<T = unknown>(event: APIGatewayProxyEventV2): T {
  if (!event.body) return {} as T
  try {
    return JSON.parse(event.body) as T
  } catch {
    throw new InvalidBodyError()
  }
}

export function getPathParam(event: APIGatewayProxyEventV2, key: string): string | null {
  return event.pathParameters?.[key] ?? null
}

export function getQueryParam(event: APIGatewayProxyEventV2, key: string): string | null {
  return event.queryStringParameters?.[key] ?? null
}
