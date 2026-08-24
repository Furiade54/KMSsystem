import type { Request, Response, NextFunction } from 'express'
import type { ApiResponse } from '../../../../packages/shared-types/src'
import * as Svc from './requests.service'

function readIntQuery(v: unknown, d: number, min: number, max: number): number {
  if (v == null) return d
  const n = Number(v)
  if (!Number.isFinite(n)) return d
  const i = Math.floor(n)
  if (i < min) return min
  if (i > max) return max
  return i
}

function readStr(v: unknown): string | null {
  return v == null ? null : String(v).trim() || null
}

function getAuth(req: Request) {
  if (!req.auth) {
    throw new Error('No auth')
  }
  return {
    userId: req.auth.userId,
    organizationId: req.auth.organizationId,
    email: req.auth.email,
    token: req.auth.token,
  }
}

export async function getPendingCount(req: Request, res: Response<ApiResponse<{ pendingReceived: number; pendingSent: number; totalPending: number }>>, next: NextFunction) {
  try {
    const auth = getAuth(req)
    const data = await Svc.pendingCount(auth)
    res.status(200).json({ success: true, data })
  } catch (e) { next(e) }
}

export async function listRequests(req: Request, res: Response<ApiResponse<{ items: Svc.ApiAccessRequest[]; total: number; page: number; pageSize: number; totalPages: number; scope: string; status: string | null }>>, next: NextFunction) {
  try {
    const auth = getAuth(req)
    const scopeRaw = readStr(req.query.scope) || 'received'
    const scope = scopeRaw === 'sent' || scopeRaw === 'all' ? scopeRaw : 'received'
    const statusRaw = readStr(req.query.status) as Svc.SolicitudEstado | null
    const status = statusRaw === 'PENDIENTE' || statusRaw === 'APROBADO' || statusRaw === 'RECHAZADO' ? statusRaw : null
    const page = readIntQuery(req.query.page, 1, 1, 10_000)
    const pageSize = readIntQuery(req.query.pageSize, 20, 1, 100)
    const data = await Svc.listMyRequests(auth, { scope, status, page, pageSize })
    res.status(200).json({ success: true, data: { ...data, scope, status } })
  } catch (e) { next(e) }
}

export async function createRequest(req: Request, res: Response<ApiResponse<Svc.ApiAccessRequest>>, next: NextFunction) {
  try {
    const auth = getAuth(req)
    const body = req.body || {}
    const created = await Svc.createRequest(
      auth,
      { resourceType: body.resourceType, resourceId: body.resourceId, message: body.message },
      { req }
    )
    res.status(201).json({ success: true, data: created })
  } catch (e) { next(e) }
}

export async function resolveApprove(req: Request, res: Response<ApiResponse<Svc.ApiAccessRequest>>, next: NextFunction) {
  try {
    const auth = getAuth(req)
    const id = req.params.id ? String(req.params.id) : ''
    const scope = String(req.body?.permissionScope || 'view').trim()
    const permissionScope = scope === 'full' ? 'full' : 'view'
    const updated = await Svc.resolveRequest(auth, id, 'APROBADO', { req, permissionScope })
    res.status(200).json({ success: true, data: updated })
  } catch (e) { next(e) }
}

export async function resolveReject(req: Request, res: Response<ApiResponse<Svc.ApiAccessRequest>>, next: NextFunction) {
  try {
    const auth = getAuth(req)
    const id = req.params.id ? String(req.params.id) : ''
    const updated = await Svc.resolveRequest(auth, id, 'RECHAZADO', { req })
    res.status(200).json({ success: true, data: updated })
  } catch (e) { next(e) }
}
