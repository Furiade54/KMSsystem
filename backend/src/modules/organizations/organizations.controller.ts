import type { Request, Response, NextFunction } from 'express'
import { getDbPool } from '../../shared/db/pool'
import { getOrganizationById, updateOrganization } from './organizations.service'
import type { ApiResponse } from '../../../../packages/shared-types/src'

export async function getOrganizationEndpoint(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
) {
  try {
    if (!req.auth) return next(new Error('auth missing'))
    const pool = await getDbPool()
    const org = await getOrganizationById(pool, req.auth.organizationId)
    res.status(200).json({ success: true, data: org })
  } catch (e) {
    next(e)
  }
}

export async function updateOrganizationEndpoint(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
) {
  try {
    if (!req.auth) return next(new Error('auth missing'))
    const pool = await getDbPool()
    const org = await updateOrganization(pool, req.auth.organizationId, {
      name: req.body?.name,
      nit: req.body?.nit ?? req.body?.nit === '' ? req.body.nit : undefined,
      logoUrl: req.body?.logoUrl ?? req.body?.logoUrl === '' ? req.body.logoUrl : undefined,
      status: req.body?.status,
    })
    res.status(200).json({ success: true, data: org })
  } catch (e) {
    next(e)
  }
}
