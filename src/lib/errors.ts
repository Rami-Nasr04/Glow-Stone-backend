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

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message)
    this.name = "NotFoundError"
  }
}
