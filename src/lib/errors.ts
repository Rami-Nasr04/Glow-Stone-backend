export class InvalidBodyError extends Error {
  constructor() {
    super("Invalid JSON body")
    this.name = "InvalidBodyError"
  }
}

// Thrown by services when a business rule fails. Mapped to 400 VALIDATION.
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ValidationError"
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message)
    this.name = "UnauthorizedError"
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Insufficient permissions") {
    super(message)
    this.name = "ForbiddenError"
  }
}

// Thrown when the request is fine but the current state refuses it (e.g. a piece already has 30 photos). Mapped to 409.
export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConflictError"
  }
}

// An order refused because of the shop's state (UNAVAILABLE, PRICE_CHANGED, ORDER_LIMIT). Mapped to 409 with its
// own code; productId names the cart line it is about, when it is about one.
export class OrderRefusedError extends Error {
  constructor(
    readonly code: "UNAVAILABLE" | "PRICE_CHANGED" | "ORDER_LIMIT",
    message: string,
    readonly productId?: number,
  ) {
    super(message)
    this.name = "OrderRefusedError"
  }
}

// The same order key sent with a different order (the shop makes a new key whenever the cart or the delivery
// details change, so only a shop bug gets here). Mapped to 422, as in the IETF Idempotency-Key draft.
export class RequestReusedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RequestReusedError"
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message)
    this.name = "NotFoundError"
  }
}

// Thrown when a service we call (e.g. Vercel's deploy hook) fails. Mapped to 502 with its own code.
export class UpstreamError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "UpstreamError"
  }
}
