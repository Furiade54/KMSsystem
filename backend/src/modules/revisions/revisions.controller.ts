import type { Request, Response, NextFunction } from 'express'
import { getDbPool } from '../../shared/db/pool'
import {
  assignRevision,
  createRevision,
  getRevisionById,
  listRevisions,
  updateRevisionStatus,
} from './revisions.service'
import type { RevisionEstado } from './revisions.service'
import type { ApiResponse } from '../../../../packages/shared-types/src'

type AuthR = { auth: { userId: string; organizationId: string; email: string } }

export async function listRevisionsEndpoint(req: Request, res: Response<ApiResponse<any>>, next: NextFunction) {
  try {
    const { auth } = req as unknown as AuthR
    const pool = await getDbPool()
    const forUserId = req.query.me === 'true' ? auth.userId : req.query.userId ? String(req.query.userId) : undefined
    const status = req.query.status ? String(req.query.status) as RevisionEstado : undefined
    const resourceId = req.query.resourceId ? String(req.query.resourceId) : undefined
    const page = req.query.page ? Number(req.query.page) : undefined
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : undefined
    const result = await listRevisions(pool, {
      organizationId: auth.organizationId,
      forUserId, status, resourceId, page, pageSize,
    })
    res.status(200).json({ success: true, data: result })
  } catch (e) { next(e) }
}

export async function getRevisionEndpoint(req: Request, res: Response<ApiResponse<any>>, next: NextFunction) {
  try {
    const { auth } = req as unknown as AuthR
    const pool = await getDbPool()
    const data = await getRevisionById(pool, auth.organizationId, String(req.params.id))
    res.status(200).json({ success: true, data })
  } catch (e) { next(e) }
}

export async function createRevisionEndpoint(req: Request, res: Response<ApiResponse<any>>, next: NextFunction) {
  try {
    const { auth } = req as unknown as AuthR
    const pool = await getDbPool()
    const b: any = req.body ?? {}
    const data = await createRevision(pool, {
      organizationId: auth.organizationId,
      requesterId: auth.userId,
      reviewerId: String(b.reviewerId ?? ''),
      resourceId: String(b.resourceId ?? ''),
      resourceType: b.resourceType ? String(b.resourceType) : undefined,
      comments: b.comments ?? null,
      deadlineAt: b.deadlineAt ?? null,
      status: b.status,
    })
    res.status(201).json({ success: true, data })
  } catch (e) { next(e) }
}

export async function updateRevisionStatusEndpoint(req: Request, res: Response<ApiResponse<any>>, next: NextFunction) {
  try {
    const { auth } = req as unknown as AuthR
    const pool = await getDbPool()
    const b: any = req.body ?? {}
    const data = await updateRevisionStatus(pool, {
      organizationId: auth.organizationId,
      revisionId: String(req.params.id),
      status: b.status,
      comments: b.comments,
    })
    res.status(200).json({ success: true, data })
  } catch (e) { next(e) }
}

export async function assignRevisionEndpoint(req: Request, res: Response<ApiResponse<any>>, next: NextFunction) {
  try {
    const { auth } = req as unknown as AuthR
    const pool = await getDbPool()
    const b: any = req.body ?? {}
    const data = await assignRevision(pool, {
      organizationId: auth.organizationId,
      revisionId: String(req.params.id),
      reviewerId: String(b.reviewerId ?? ''),
      deadlineAt: b.deadlineAt ?? null,
      comments: b.comments ?? null,
    })
    res.status(200).json({ success: true, data, message: 'Revisión asignada' })
  } catch (e) { next(e) }
}
