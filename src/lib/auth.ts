import type { APIGatewayProxyEventV2 } from "aws-lambda"
import { requiredEnv } from "./env"
import { UnauthorizedError } from "./errors"

export interface TokenOwner {
  sub: string
}

// API Gateway's authorizer has already checked the token's signature, expiry, issuer and app client.
// This second check makes a route refuse anything else even if it were ever attached to the wrong
// authorizer (or none): only an access token from the given pool, issued to the given app client, passes.
function requireAccessToken(event: APIGatewayProxyEventV2, poolEnv: string, clientEnv: string): TokenOwner {
  const issuer = `https://cognito-idp.${requiredEnv("AWS_REGION")}.amazonaws.com/${requiredEnv(poolEnv)}`
  const clientId = requiredEnv(clientEnv)
  const claims = (event.requestContext as { authorizer?: { jwt?: { claims?: Record<string, unknown> } } })
    ?.authorizer?.jwt?.claims
  if (
    !claims ||
    claims.iss !== issuer ||
    claims.token_use !== "access" ||
    claims.client_id !== clientId ||
    typeof claims.sub !== "string" ||
    claims.sub === ""
  ) {
    throw new UnauthorizedError()
  }
  return { sub: claims.sub }
}

// Being in the admin pool is the admin role (no groups); the studio's app client.
export function requireAdmin(event: APIGatewayProxyEventV2): TokenOwner {
  return requireAccessToken(event, "ADMIN_USER_POOL_ID", "ADMIN_APP_CLIENT_ID")
}

// A shop customer: the customer pool and the shop's app client. The sub is the customers row's id.
export function requireCustomer(event: APIGatewayProxyEventV2): TokenOwner {
  return requireAccessToken(event, "CUSTOMER_USER_POOL_ID", "CUSTOMER_APP_CLIENT_ID")
}
