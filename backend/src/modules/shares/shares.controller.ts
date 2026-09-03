import type { Request, Response, NextFunction } from 'express'
import { getDbPool } from '../../shared/db/pool'
import {
  createShared, deleteShared,
  listSharedByUser, getSharedById,
  publicAccessShared,
} from './shares.service'
import type { TipoRecursoCompartido } from './shares.service'
import type { ApiResponse } from '../../../../packages/shared-types/src'

type AuthR = { auth: { userId: string; organizationId: string; email: string; isOrgAdmin?: boolean } }

export async function shareFileEndpoint(req: Request, res: Response<ApiResponse<any>>, next: NextFunction) {
  try {
    const { auth } = req as unknown as AuthR
    const pool = await getDbPool()
    const b: any = req.body ?? {}
    const data = await createShared(pool, {
      organizationId: auth.organizationId,
      sharedById: auth.userId,
      resourceType: b.resourceType ?? 'ARCHIVO' as TipoRecursoCompartido,
      resourceId: String(b.resourceId ?? req.params.id),
      targetUserId: b.targetUserId ?? null,
      password: b.password ?? null,
      expiresAt: b.expiresAt ?? null,
      createPublicLink: b.publicLink !== false,
    })
    res.status(201).json({ success: true, data, message: 'Recurso compartido creado' })
  } catch (e) { next(e) }
}

export async function shareResourceEndpoint(req: Request, res: Response<ApiResponse<any>>, next: NextFunction) {
  try {
    const { auth } = req as unknown as AuthR
    const pool = await getDbPool()
    const b: any = req.body ?? {}
    const data = await createShared(pool, {
      organizationId: auth.organizationId,
      sharedById: auth.userId,
      resourceType: String(b.resourceType ?? 'ARCHIVO') as TipoRecursoCompartido,
      resourceId: String(b.resourceId ?? ''),
      targetUserId: b.targetUserId ?? null,
      password: b.password ?? null,
      expiresAt: b.expiresAt ?? null,
      createPublicLink: b.publicLink !== false,
    })
    res.status(201).json({ success: true, data })
  } catch (e) { next(e) }
}

export async function listSharesEndpoint(req: Request, res: Response<ApiResponse<any>>, next: NextFunction) {
  try {
    const { auth } = req as unknown as AuthR
    const pool = await getDbPool()
    const data = await listSharedByUser(pool, auth.organizationId, auth.userId, {
      resourceType: req.query.resourceType ? String(req.query.resourceType) as TipoRecursoCompartido : undefined,
    })
    res.status(200).json({ success: true, data })
  } catch (e) { next(e) }
}

export async function getShareEndpoint(req: Request, res: Response<ApiResponse<any>>, next: NextFunction) {
  try {
    const { auth } = req as unknown as AuthR
    const pool = await getDbPool()
    const data = await getSharedById(pool, auth.organizationId, String(req.params.id))
    res.status(200).json({ success: true, data })
  } catch (e) { next(e) }
}

export async function deleteShareEndpoint(req: Request, res: Response<ApiResponse<void>>, next: NextFunction) {
  try {
    const { auth } = req as unknown as AuthR
    const pool = await getDbPool()
    await deleteShared(pool, auth.organizationId, auth.userId, String(req.params.id), auth.isOrgAdmin)
    res.status(204).end()
  } catch (e) { next(e) }
}

export async function publicAccessEndpoint(req: Request, res: Response<ApiResponse<any>>, next: NextFunction) {
  try {
    const token = String(req.params.token ?? '')
    const pool = await getDbPool()
    const result = await publicAccessShared(pool, token, {
      password: req.body?.password ?? req.query?.password ?? null,
    })
    if (!result.ok) {
      const msgs: Record<string, string> = {
        not_found: 'Enlace no encontrado',
        expired: 'Enlace expirado',
        bad_password: 'Contraseña incorrecta',
      }
      return res.status(401).json({
        success: false,
        message: msgs[result.reason ?? ''] ?? 'Acceso denegado',
        data: { code: result.reason } as any,
      })
    }
    res.status(200).json({ success: true, data: { share: result.share, file: result.fileInfo ?? null } })
  } catch (e) { next(e) }
}
