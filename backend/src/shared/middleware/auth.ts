import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../auth/crypto'
import { UnauthorizedError } from '../errors/AppError'
import type { PermissionCode, RoleAssignment } from '../../../../packages/shared-types/src'

export interface AuthContext {
  userId: string
  organizationId: string
  email: string
  token: string
  roles?: RoleAssignment[]
  isOrgAdmin?: boolean
  permissions?: ReadonlySet<PermissionCode>
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (req.method === 'OPTIONS') return next()
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Token de autorización requerido'))
  }
  const token = header.slice(7)
  try {
    const payload = verifyToken(token)
    req.auth = {
      userId: payload.sub,
      organizationId: payload.organizationId,
      email: payload.email,
      token,
    }
    next()
  } catch {
    next(new UnauthorizedError('Token inválido o expirado'))
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  if (req.method === 'OPTIONS') return next()
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return next()
  const token = header.slice(7)
  try {
    const payload = verifyToken(token)
    req.auth = {
      userId: payload.sub,
      organizationId: payload.organizationId,
      email: payload.email,
      token,
    }
  } catch {
    /* ignore */
  }
  next()
}
