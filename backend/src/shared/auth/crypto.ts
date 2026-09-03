import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { env } from '../config/env'

export interface TokenPayload {
  sub: string
  organizationId: string
  email: string
  iat?: number
  exp?: number
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return bcrypt.hash(password, saltRounds)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

export function signToken(payload: TokenPayload): string {
  const secret: jwt.Secret = env.JWT_SECRET as jwt.Secret
  if (!secret) throw new Error('JWT_SECRET no configurado')
  return jwt.sign(payload, secret, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  })
}

export function verifyToken(token: string): TokenPayload {
  try {
    const secret: jwt.Secret = env.JWT_SECRET as jwt.Secret
    return jwt.verify(token, secret) as TokenPayload
  } catch {
    throw new Error('Token inválido o expirado')
  }
}

export function getTokenExpiration(): Date {
  const match = env.JWT_EXPIRES_IN.match(/^(\d+)([smhd])$/)
  const now = Date.now()
  if (!match) return new Date(now + 24 * 60 * 60 * 1000)
  const [, val, unit] = match
  const n = parseInt(val, 10)
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000
  return new Date(now + n * mult)
}
