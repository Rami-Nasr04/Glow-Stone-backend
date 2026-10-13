import type { APIGatewayProxyEventV2 } from "aws-lambda"
import { requiredEnv } from "./env"
import { UnauthorizedError } from "./errors"

export interface AdminAuth {
  sub: string
}

// API Gateway's admin authorizer has already checked the token's signature, expiry, issuer and app client.
// This second check makes an admin route refuse anything else even if it were ever attached to the wrong
// authorizer (or none): only an access token from the admin pool, issued to the studio's app client, passes.
// Being in the admin pool is the admin role (no groups).
export function requireAdmin(event: APIGatewayProxyEventV2): AdminAuth {
  const issuer = `https://cognito-idp.${requiredEnv("AWS_REGION")}.amazonaws.com/${requiredEnv("ADMIN_USER_POOL_ID")}`
  const clientId = requiredEnv("ADMIN_APP_CLIENT_ID")
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
