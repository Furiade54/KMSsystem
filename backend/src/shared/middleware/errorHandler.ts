import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../errors/AppError'
import { isDev } from '../config/env'
import type { ApiResponse } from '../../../../packages/shared-types/src'

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(`Ruta ${req.method} ${req.originalUrl} no encontrada`, 404))
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    const body: ApiResponse<null> = {
      success: false,
      message: err.message,
      error: err.message,
      errors: err.errors,
    }
    return res.status(err.statusCode).json(body)
  }

  if (err instanceof Error) {
    console.error('💥 Error inesperado:', err)
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: isDev ? err.message : undefined,
      stack: isDev ? err.stack : undefined,
    })
  }

  return res.status(500).json({
    success: false,
    message: 'Error desconocido',
  })
}
