export class AppError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean
  public readonly errors?: Record<string, string[]>
  public readonly details?: unknown

  constructor(message: string, statusCode: number = 500, errors?: Record<string, string[]>, details?: unknown) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.statusCode = statusCode
    this.isOperational = statusCode < 500
    this.errors = errors
    this.details = details
    Error.captureStackTrace(this)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'No autorizado') {
    super(message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acceso denegado') {
    super(message, 403)
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Solicitud inválida', errors?: Record<string, string[]>) {
    super(message, 400, errors)
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflicto', errors?: Record<string, string[]>, details?: unknown) {
    super(message, 409, errors, details)
  }
}
