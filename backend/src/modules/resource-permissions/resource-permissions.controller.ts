import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import type {
  CreateResourcePermissionDto,
  ResourceTypeApi,
  UpdateResourcePermissionDto,
} from '../../../../packages/shared-types/src'
import { getDbPool } from '../../shared/db/pool'
import {
  ensureActorCanManagePermissions,
  getGrantById,
  getPermissionsForResource,
  revokeGrantById,
  updateGrantById,
  upsertGrant,
} from './resource-permissions.service'
import { ensureAuthWithRoles } from '../../shared/middleware/rbac'
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError'

function ok<T>(data: T) {
  return { ok: true as const, data }
}
function err(message: string, code: number = 400, details?: Record<string, string>) {
  return { ok: false as const, error: message, code, details }
}

const GrantCreateSchema = z
  .object({
    userId: z.string().uuid().optional(),
    roleId: z.string().uuid().optional(),
    puedeVer: z.boolean(),
    puedeDescargar: z.boolean().optional().default(false),
    puedeComentar: z.boolean().optional().default(false),
    puedeEditar: z.boolean().optional().default(false),
    puedeCompartir: z.boolean().optional().default(false),
    puedeAdministrar: z.boolean().optional().default(false),
  })
  .strict()

const GrantUpdateSchema = z
  .object({
    puedeVer: z.boolean().optional(),
    puedeDescargar: z.boolean().optional(),
    puedeComentar: z.boolean().optional(),
    puedeEditar: z.boolean().optional(),
    puedeCompartir: z.boolean().optional(),
    puedeAdministrar: z.boolean().optional(),
  })
  .strict()

function flattenZodErrors(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of issues) out[i.path.join('.') || '_'] = i.message
  return out
}

const RESOURCE_PATH_TO_TYPE: Record<string, ResourceTypeApi> = {
  projects: 'PROJECT',
  carpetas: 'FOLDER',
  archivos: 'FILE',
}

function parseListParams(req: Request) {
  const { page, pageSize, search, scope } = req.query as any
  return {
    page: page != null ? Number(page) : undefined,
    pageSize: pageSize != null ? Number(pageSize) : undefined,
    search: typeof search === 'string' ? search : undefined,
    scope: (scope === 'users' || scope === 'roles' || scope === 'all') ? scope : undefined,
  }
}

export async function listPermissionsByResourceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = await ensureAuthWithRoles(req)
    const pool = await getDbPool()
    const resourcePath = (req.baseUrl.split('/').pop() || (req.params as any)._resourceType || '') as keyof typeof RESOURCE_PATH_TO_TYPE
    const resourceType = RESOURCE_PATH_TO_TYPE[resourcePath]
    if (!resourceType) throw new BadRequestError('Endpoint no válido para listar permisos')
    const id = String(req.params.id)
    const result = await getPermissionsForResource(pool, auth, resourceType, id, parseListParams(req))
    return res.status(200).json(ok(result))
  } catch (err) {
    next(err)
  }
}

export async function upsertPermissionByResourceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const resourcePath = (req.baseUrl.split('/').pop() || '') as keyof typeof RESOURCE_PATH_TO_TYPE
    const resourceType = RESOURCE_PATH_TO_TYPE[resourcePath]
    if (!resourceType) throw new BadRequestError('Endpoint no válido para crear permiso')
    const id = String(req.params.id)
    const parsed = GrantCreateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json(
        err('Datos inválidos para crear el permiso', 400, flattenZodErrors(parsed.error.issues))
      )
    }
    const { auth } = await ensureActorCanManagePermissions(req, resourceType, id)
    const pool = await getDbPool()
    const saved = await upsertGrant(
      pool,
      auth,
      resourceType,
      id,
      parsed.data as CreateResourcePermissionDto,
      req
    )
    return res.status(200).json(ok(saved))
  } catch (err) {
    next(err)
  }
}

export async function getPermissionDetailHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = await ensureAuthWithRoles(req)
    const pool = await getDbPool()
    const id = String(req.params.id)
    const g = await getGrantById(pool, auth, id)
    if (!g) throw new NotFoundError('Permiso no encontrado')
    return res.status(200).json(ok(g))
  } catch (err) {
    next(err)
  }
}

export async function updatePermissionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = await ensureAuthWithRoles(req)
    const pool = await getDbPool()
    const id = String(req.params.id)
    const current = await getGrantById(pool, auth, id)
    if (!current) throw new NotFoundError('Permiso no encontrado')
    const parsed = GrantUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json(
        err('Datos inválidos para actualizar el permiso', 400, flattenZodErrors(parsed.error.issues))
      )
    }
    await ensureActorCanManagePermissions(req, current.resourceType, current.resourceId)
    const saved = await updateGrantById(pool, auth, id, parsed.data as UpdateResourcePermissionDto, req)
    return res.status(200).json(ok(saved))
  } catch (err) {
    next(err)
  }
}

export async function deletePermissionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = await ensureAuthWithRoles(req)
    const pool = await getDbPool()
    const id = String(req.params.id)
    const current = await getGrantById(pool, auth, id)
    if (current) {
      await ensureActorCanManagePermissions(req, current.resourceType, current.resourceId)
      await revokeGrantById(pool, auth, id, req)
    }
    return res.status(204).end()
  } catch (err) {
    next(err)
  }
}

export async function canAccessCheckHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = await ensureAuthWithRoles(req)
    const pool = await getDbPool()
    const { resourceType, resourceId, capability } = (req.query as any)
    if (!resourceType || !resourceId || !capability) {
      throw new BadRequestError('Faltan query params: resourceType, resourceId, capability')
    }
    const rtMap: Record<string, ResourceTypeApi> = { PROJECT: 'PROJECT', FOLDER: 'FOLDER', FILE: 'FILE', proyecto: 'PROJECT', carpeta: 'FOLDER', archivo: 'FILE' }
    const rt = rtMap[String(resourceType)]
    if (!rt) throw new BadRequestError('resourceType inválido')
    const { hasCapabilityOnResource } = require('./resource-permissions.service')
    const granted = await hasCapabilityOnResource(pool, auth, rt, String(resourceId), String(capability).toUpperCase(), { req })
    return res.status(200).json(ok({ granted: Boolean(granted) }))
  } catch (err) {
    next(err)
  }
}

export function buildResourcePermissionsMiddleware(resourceBase: 'projects' | 'carpetas' | 'archivos') {
  const innerRouter = require('express').Router({ mergeParams: true })
  innerRouter.get('/:id/permisos', listPermissionsByResourceHandler)
  innerRouter.post('/:id/permisos', upsertPermissionByResourceHandler)
  // inyectar resource path
  innerRouter.use((_req: Request, _res: Response, next: NextFunction) => {
    ;(_req as any)._resourceType = resourceBase
    next()
  })
  return innerRouter
}
