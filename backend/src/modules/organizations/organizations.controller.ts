import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { getDbPool } from '../../shared/db/pool'
import {
  getOrganizationById,
  updateOrganization,
  listOrganizations,
  createOrganization as createOrganizationSvc,
  softDeleteOrganization,
  permanentlyDeleteOrganization,
} from './organizations.service'
import type { ApiResponse, PaginatedResult } from '../../../../packages/shared-types/src'
import type { Organization as OrganizationEntity } from './organizations.service'
import { BadRequestError, ForbiddenError } from '../../shared/errors/AppError'

type AuthReq = { auth: { organizationId: string; userId: string } }

const CreateOrgSchema = z.object({
  name: z.string().min(2, 'Nombre requerido (mínimo 2 caracteres)').max(200, 'Nombre demasiado largo'),
  taxId: z.string().max(50, 'NIT demasiado largo').nullable().optional(),
  logoUrl: z.string().max(1000, 'URL logo demasiado larga').nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

const UpdateOrgSchema = z.object({
  name: z.string().min(2, 'Nombre requerido (mínimo 2 caracteres)').max(200).optional(),
  taxId: z.string().max(50).nullable().optional(),
  logoUrl: z.string().max(1000).nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

function buildError(payload: any, fallback: string): string {
  const detail = payload?.error ? ` · ${String(payload.error)}` : ''
  return (payload?.message || fallback) + detail
}

function flattenZodErrors(issues: z.ZodIssue[]): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  for (const i of issues) {
    const k = i.path.join('.') || '_'
    if (!errors[k]) errors[k] = []
    errors[k].push(i.message)
  }
  return errors
}

export async function getOrganizationEndpoint(
  req: Request,
  res: Response<ApiResponse<OrganizationEntity>>,
  next: NextFunction
) {
  try {
    if (!req.auth) return next(new Error('auth missing'))
    const pool = await getDbPool()
    const org = await getOrganizationById(pool, req.auth.organizationId, { includeDeleted: true })
    res.status(200).json({ success: true, data: org })
  } catch (e) {
    next(e)
  }
}

export async function updateOrganizationEndpoint(
  req: Request,
  res: Response<ApiResponse<OrganizationEntity>>,
  next: NextFunction
) {
  try {
    if (!req.auth) return next(new Error('auth missing'))
    const body = { ...req.body }
    if ('nit' in body && !('taxId' in body)) {
      body.taxId = (body as any).nit
      delete (body as any).nit
    }
    const parsed = UpdateOrgSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestError('Datos de actualización inválidos', flattenZodErrors(parsed.error.issues))
    }
    const pool = await getDbPool()
    const org = await updateOrganization(pool, req.auth.organizationId, parsed.data, req.auth, req)
    res.status(200).json({ success: true, data: org, message: 'Organización actualizada correctamente' })
  } catch (e) {
    next(e)
  }
}

export async function createOrganizationHandler(
  req: Request,
  res: Response<ApiResponse<OrganizationEntity>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as AuthReq).auth
    if (!auth) return next(new Error('auth missing'))
    const body = { ...req.body }
    if ('nit' in body && !('taxId' in body)) {
      body.taxId = (body as any).nit
      delete (body as any).nit
    }
    const parsed = CreateOrgSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestError('Datos de organización inválidos', flattenZodErrors(parsed.error.issues))
    }
    const pool = await getDbPool()
    const created = await createOrganizationSvc(pool, parsed.data, auth, req)
    res.status(201).json({ success: true, data: created, message: 'Organización creada correctamente' })
  } catch (e) {
    next(e)
  }
}

export async function listOrganizationsHandler(
  req: Request,
  res: Response<ApiResponse<PaginatedResult<OrganizationEntity>>>,
  next: NextFunction
) {
  try {
    if (!req.auth) return next(new Error('auth missing'))
    const page = Math.max(1, Number(req.query.page || 1))
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || 25)))
    const search = req.query.search ? String(req.query.search).trim() : undefined
    const status = req.query.status ? String(req.query.status) : undefined
    const includeDeleted = req.query.includeDeleted === 'true'
    const pool = await getDbPool()
    const result = await listOrganizations(pool, { page, pageSize, search, status, includeDeleted })
    res.status(200).json({ success: true, data: result })
  } catch (e) {
    next(e)
  }
}

export async function getOrganizationByIdHandler(
  req: Request,
  res: Response<ApiResponse<OrganizationEntity>>,
  next: NextFunction
) {
  try {
    if (!req.auth) return next(new Error('auth missing'))
    const id = String(req.params.id)
    const isOwn = id.toLowerCase() === req.auth.organizationId.toLowerCase()
    const pool = await getDbPool()
    const org = await getOrganizationById(pool, id, { includeDeleted: true })
    if (!isOwn) {
      // requirePermission('org.listar') lo cubre el middleware; doble guard por si acaso
      const anyPerm = (req.auth as any).permissions as Set<string> | undefined
      if (!anyPerm || !anyPerm.has('org.listar')) {
        const isAdmin = (req.auth as any).isOrgAdmin as boolean | undefined
        if (!isAdmin) throw new ForbiddenError('No tienes permiso para ver esta organización')
      }
    }
    res.status(200).json({ success: true, data: org })
  } catch (e) {
    next(e)
  }
}

export async function updateOrganizationByIdHandler(
  req: Request,
  res: Response<ApiResponse<OrganizationEntity>>,
  next: NextFunction
) {
  try {
    if (!req.auth) return next(new Error('auth missing'))
    const id = String(req.params.id)
    const isOwn = id.toLowerCase() === req.auth.organizationId.toLowerCase()
    if (!isOwn) {
      const anyPerm = (req.auth as any).permissions as Set<string> | undefined
      const isAdmin = (req.auth as any).isOrgAdmin as boolean | undefined
      if (!isAdmin && (!anyPerm || !anyPerm.has('org.editar'))) {
        throw new ForbiddenError('No tienes permiso para editar esta organización')
      }
    }
    const body = { ...req.body }
    if ('nit' in body && !('taxId' in body)) {
      body.taxId = (body as any).nit
      delete (body as any).nit
    }
    const parsed = UpdateOrgSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestError('Datos de actualización inválidos', flattenZodErrors(parsed.error.issues))
    }
    const pool = await getDbPool()
    const updated = await updateOrganization(pool, id, parsed.data, req.auth, req)
    res.status(200).json({ success: true, data: updated, message: 'Organización actualizada correctamente' })
  } catch (e) {
    next(e)
  }
}

export async function deleteOrganizationHandler(
  req: Request,
  res: Response<ApiResponse<void>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as AuthReq).auth
    if (!auth) return next(new Error('auth missing'))
    const id = String(req.params.id)
    const pool = await getDbPool()
    await softDeleteOrganization(pool, auth, id, req)
    res.status(204).end()
  } catch (e) {
    next(e)
  }
}

export async function permanentlyDeleteOrganizationHandler(
  req: Request,
  res: Response<ApiResponse<void>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as AuthReq).auth
    if (!auth) return next(new Error('auth missing'))
    const id = String(req.params.id)
    await permanentlyDeleteOrganization(auth, id, req)
    res.status(204).end()
  } catch (e) {
    next(e)
  }
}

export { buildError as buildOrgError }
