import type { ConnectionPool, Request } from 'mssql'
import crypto from 'crypto'
import type { Request as ExpressRequest } from 'express'
import { getDbPool, sql } from '../../shared/db/pool'
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError'
import { sqlLocalToIso, sqlLocalToIsoOrNull } from '../../shared/utils/date'
import { logAuditRecord } from '../../shared/db/audit'
import type {
  CreateOrganizationDto,
  EntityStatus,
  Organization as SharedOrganization,
  PaginatedResult,
  UpdateOrganizationDto,
} from '../../../../packages/shared-types/src'

const STATUS_ES_TO_EN: Record<string, EntityStatus> = {
  ACTIVO: 'ACTIVE',
  INACTIVO: 'INACTIVE',
  ELIMINADO: 'DELETED',
}

const STATUS_EN_TO_ES: Record<string, string> = {
  ACTIVE: 'ACTIVO',
  INACTIVE: 'INACTIVO',
  DELETED: 'ELIMINADO',
}

function mapStatus(es: unknown): EntityStatus {
  const key = String(es || 'ACTIVO').toUpperCase()
  return STATUS_ES_TO_EN[key] ?? 'ACTIVE'
}

function toEsStatus(en: EntityStatus | undefined): string {
  if (!en) return 'ACTIVO'
  return STATUS_EN_TO_ES[en] ?? en
}

export type Organization = SharedOrganization & {
  usersCount?: number
  projectsCount?: number
}

function mapOrg(row: any): Organization {
  return {
    id: String(row.Id),
    name: String(row.Nombre),
    taxId: row.NIT != null ? String(row.NIT) : null,
    logoUrl: row.LogoUrl != null ? String(row.LogoUrl) : null,
    status: mapStatus(row.Estado),
    createdAt: sqlLocalToIso(row.FechaCreacion as any),
    updatedAt: sqlLocalToIsoOrNull(row.FechaActualizacion as any),
    usersCount: row.UsuariosCount != null ? Number(row.UsuariosCount) : undefined,
    projectsCount: row.ProyectosCount != null ? Number(row.ProyectosCount) : undefined,
  }
}

function appendWhere(
  req: Request,
  opts: {
    search?: string
    status?: string
    includeDeleted?: boolean
    onlyOrgId?: string
  }
): string {
  const clauses: string[] = []
  if (!opts.includeDeleted) clauses.push("o.Estado <> 'ELIMINADO'")
  if (opts.status) {
    const es = STATUS_EN_TO_ES[opts.status.toUpperCase()] ?? opts.status
    clauses.push('o.Estado = @status')
    req.input('status', sql.VarChar(20), es)
  }
  if (opts.search) {
    clauses.push('(LOWER(o.Nombre) LIKE @search OR LOWER(ISNULL(o.NIT, \'\')) LIKE @search)')
    req.input('search', sql.NVarChar(400), `%${opts.search.toLowerCase()}%`)
  }
  if (opts.onlyOrgId) {
    clauses.push('o.Id = @onlyOrgId')
    req.input('onlyOrgId', sql.UniqueIdentifier, opts.onlyOrgId)
  }
  return clauses.length > 0 ? ' WHERE ' + clauses.join(' AND ') : ''
}

export async function getOrganizationById(
  pool: ConnectionPool,
  organizationId: string,
  opts?: { includeDeleted?: boolean }
): Promise<Organization> {
  const req = pool.request()
  req.input('id', sql.UniqueIdentifier, organizationId)
  const where = appendWhere(req, { includeDeleted: opts?.includeDeleted, onlyOrgId: organizationId })
  const { recordset } = await req.query(`
    SELECT o.Id, o.Nombre, o.NIT, o.LogoUrl, o.Estado, o.FechaCreacion, o.FechaActualizacion,
           (SELECT COUNT(*) FROM dbo.Usuarios u WHERE u.IdOrganizacion = o.Id AND u.Estado <> 'ELIMINADO') UsuariosCount,
           (SELECT COUNT(*) FROM dbo.Proyectos p WHERE p.IdOrganizacion = o.Id AND p.Estado <> 'ELIMINADO') ProyectosCount
    FROM dbo.Organizaciones o
    ${where}
  `)
  if (recordset.length === 0) throw new NotFoundError('Organización no encontrada')
  return mapOrg(recordset[0])
}

export async function listOrganizations(
  pool: ConnectionPool,
  opts: {
    page?: number
    pageSize?: number
    search?: string
    status?: string
    includeDeleted?: boolean
    onlyOrganizationId?: string
  }
): Promise<PaginatedResult<Organization>> {
  const page = Math.max(1, Number(opts.page || 1))
  const pageSize = Math.max(1, Math.min(100, Number(opts.pageSize || 25)))
  const off = (page - 1) * pageSize

  const reqCount = pool.request()
  const whereCount = appendWhere(reqCount, {
    search: opts.search,
    status: opts.status,
    includeDeleted: opts.includeDeleted,
    onlyOrgId: opts.onlyOrganizationId,
  })
  const countRes = await reqCount.query(`
    SELECT COUNT(*) Total
    FROM dbo.Organizaciones o
    ${whereCount}
  `)
  const total = Number(countRes.recordset[0]?.Total ?? 0)

  const reqRows = pool.request()
  const whereRows = appendWhere(reqRows, {
    search: opts.search,
    status: opts.status,
    includeDeleted: opts.includeDeleted,
    onlyOrgId: opts.onlyOrganizationId,
  })
  reqRows.input('off', sql.Int, off)
  reqRows.input('lim', sql.Int, pageSize)
  const rows = await reqRows.query<any>(`
    SELECT o.Id, o.Nombre, o.NIT, o.LogoUrl, o.Estado, o.FechaCreacion, o.FechaActualizacion,
           (SELECT COUNT(*) FROM dbo.Usuarios u WHERE u.IdOrganizacion = o.Id AND u.Estado <> 'ELIMINADO') UsuariosCount,
           (SELECT COUNT(*) FROM dbo.Proyectos p WHERE p.IdOrganizacion = o.Id AND p.Estado <> 'ELIMINADO') ProyectosCount
    FROM dbo.Organizaciones o
    ${whereRows}
    ORDER BY o.FechaCreacion DESC, o.Nombre ASC
    OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
  `)
  const items = rows.recordset.map(mapOrg)
  const totalPages = Math.max(1, total === 0 ? 0 : Math.ceil(total / pageSize))
  return { items, total, page, pageSize, totalPages }
}

async function assertUniqueOrgName(
  pool: ConnectionPool,
  name: string,
  excludeId?: string
): Promise<void> {
  const req = pool.request()
  req.input('name', sql.NVarChar(200), name)
  let query = 'SELECT TOP 1 Id FROM dbo.Organizaciones WHERE LOWER(Nombre) = LOWER(@name)'
  if (excludeId) {
    req.input('excludeId', sql.UniqueIdentifier, excludeId)
    query += ' AND Id <> @excludeId'
  }
  const res = await req.query<{ Id: string }>(query)
  if (res.recordset.length > 0) {
    throw new ConflictError('Ya existe una organización con ese nombre')
  }
}

export async function createOrganization(
  pool: ConnectionPool,
  dto: CreateOrganizationDto,
  creatorAuth: { organizationId: string; userId: string },
  req?: ExpressRequest | null
): Promise<Organization> {
  const name = (dto.name ?? '').trim()
  if (name.length < 2) throw new BadRequestError('Nombre es requerido (mínimo 2 caracteres)')
  await assertUniqueOrgName(pool, name)
  if (dto.status && dto.status === 'DELETED') {
    throw new BadRequestError('No se puede crear una organización en estado ELIMINADO')
  }
  if (dto.status && !['ACTIVE', 'INACTIVE'].includes(dto.status)) {
    throw new BadRequestError('Estado inválido')
  }
  const esStatus = toEsStatus(dto.status ?? 'ACTIVE')
  const id = crypto.randomUUID()
  const ins = pool.request()
  ins.input('id', sql.UniqueIdentifier, id)
  ins.input('name', sql.NVarChar(200), name)
  ins.input('taxId', sql.NVarChar(50), dto.taxId != null ? (dto.taxId === '' ? null : String(dto.taxId)) : null)
  ins.input('logoUrl', sql.NVarChar(sql.MAX), dto.logoUrl != null ? (dto.logoUrl === '' ? null : String(dto.logoUrl)) : null)
  ins.input('estado', sql.VarChar(20), esStatus)
  await ins.query(`
    INSERT INTO dbo.Organizaciones (Id, Nombre, NIT, LogoUrl, Estado, FechaCreacion, FechaActualizacion)
    VALUES (@id, @name, @taxId, @logoUrl, @estado, GETDATE(), NULL)
  `)
  try {
    await logAuditRecord({
      organizationId: creatorAuth.organizationId,
      userId: creatorAuth.userId,
      action: 'ORG_CREATED',
      resourceType: 'ORGANIZATION',
      resourceId: id,
      resourceName: name,
      req: req ?? null,
    })
  } catch {}
  return getOrganizationById(pool, id)
}

export async function updateOrganization(
  pool: ConnectionPool,
  organizationId: string,
  patch: UpdateOrganizationDto,
  actorAuth: { organizationId: string; userId: string },
  req?: ExpressRequest | null
): Promise<Organization> {
  const current = await getOrganizationById(pool, organizationId)
  if (patch.status === 'DELETED') {
    throw new BadRequestError('No se puede actualizar a estado ELIMINADO; usar DELETE')
  }
  if (patch.status != null && patch.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(patch.status)) {
    throw new BadRequestError('Estado inválido')
  }
  let name: string = current.name
  if (patch.name != null) {
    const v = String(patch.name).trim()
    if (v.length < 2) throw new BadRequestError('Nombre es requerido (mínimo 2 caracteres)')
    name = v
    await assertUniqueOrgName(pool, name, organizationId)
  }
  const taxId = patch.taxId !== undefined
    ? (patch.taxId === '' ? null : String(patch.taxId))
    : current.taxId
  const logoUrl = patch.logoUrl !== undefined
    ? (patch.logoUrl === '' ? null : String(patch.logoUrl))
    : current.logoUrl
  const enStatus: EntityStatus = patch.status ?? current.status
  const esStatus = toEsStatus(enStatus)
  const sets: string[] = ['FechaActualizacion = SYSUTCDATETIME()']
  const up = pool.request()
  up.input('id', sql.UniqueIdentifier, organizationId)
  up.input('nombre', sql.NVarChar(200), name)
  sets.push('Nombre = @nombre')
  up.input('taxId', sql.NVarChar(50), taxId ?? null)
  sets.push('NIT = @taxId')
  up.input('logoUrl', sql.NVarChar(sql.MAX), logoUrl ?? null)
  sets.push('LogoUrl = @logoUrl')
  up.input('estado', sql.VarChar(20), esStatus)
  sets.push('Estado = @estado')
  await up.query(`UPDATE dbo.Organizaciones SET ${sets.join(', ')} WHERE Id = @id`)
  try {
    await logAuditRecord({
      organizationId: actorAuth.organizationId,
      userId: actorAuth.userId,
      action: 'ORG_UPDATED',
      resourceType: 'ORGANIZATION',
      resourceId: organizationId,
      resourceName: name,
      extra: {
        fields: sets
          .map((s) => s.split(' ')[0])
          .filter((s) => s !== 'FechaActualizacion'),
      },
      req: req ?? null,
    })
  } catch {}
  return getOrganizationById(pool, organizationId)
}

export async function softDeleteOrganization(
  pool: ConnectionPool,
  actorAuth: { organizationId: string; userId: string },
  orgId: string,
  req?: ExpressRequest | null
): Promise<void> {
  if (String(actorAuth.organizationId).toLowerCase() === String(orgId).toLowerCase()) {
    throw new ForbiddenError('No puedes eliminar tu propia organización')
  }
  const cur = pool.request()
  cur.input('id', sql.UniqueIdentifier, orgId)
  const r = await cur.query<{ Id: string; Nombre: string | null; Estado: string }>(
    `SELECT Id, Nombre, Estado FROM dbo.Organizaciones WHERE Id = @id`
  )
  const row = r.recordset[0]
  if (!row) throw new NotFoundError('Organización no encontrada')
  if (row.Estado === 'ELIMINADO') return
  const nombre = row.Nombre ?? null
  await cur.query(`UPDATE dbo.Organizaciones SET Estado='ELIMINADO', FechaActualizacion=GETDATE() WHERE Id = @id`)
  try {
    await logAuditRecord({
      organizationId: actorAuth.organizationId,
      userId: actorAuth.userId,
      action: 'ORG_DELETED',
      resourceType: 'ORGANIZATION',
      resourceId: orgId,
      resourceName: nombre,
      req: req ?? null,
    })
  } catch {}
}

export async function permanentlyDeleteOrganization(
  actorAuth: { organizationId: string; userId: string },
  orgId: string,
  req?: ExpressRequest | null
): Promise<void> {
  if (String(actorAuth.organizationId).toLowerCase() === String(orgId).toLowerCase()) {
    throw new ForbiddenError('No puedes eliminar permanentemente tu propia organización')
  }
  const pool = await getDbPool()
  const tx = pool.transaction()
  let orgName: string | null = null
  try {
    await tx.begin()

    const cur = tx.request()
    cur.input('orgId', sql.UniqueIdentifier, orgId)
    const r = await cur.query<{ Id: string; Nombre: string | null }>(
      `SELECT Id, Nombre FROM dbo.Organizaciones WHERE Id = @orgId`
    )
    const row = r.recordset[0]
    if (!row) throw new NotFoundError('Organización no encontrada')
    orgName = row.Nombre ?? null

    const clean = tx.request()
    clean.input('orgId', sql.UniqueIdentifier, orgId)
    await clean.batch(`
      SET NOCOUNT ON;

      DECLARE @UserIds TABLE (Id UNIQUEIDENTIFIER);
      INSERT INTO @UserIds (Id) SELECT Id FROM dbo.Usuarios WHERE IdOrganizacion = @orgId;

      DECLARE @ProjectIds TABLE (Id UNIQUEIDENTIFIER);
      INSERT INTO @ProjectIds (Id) SELECT Id FROM dbo.Proyectos WHERE IdOrganizacion = @orgId;

      DECLARE @RoleIds TABLE (Id UNIQUEIDENTIFIER);
      INSERT INTO @RoleIds (Id) SELECT Id FROM dbo.Roles WHERE IdOrganizacion = @orgId;

      -- Nulificar referencias outbound a usuarios/roles/proyectos de la org en otras tablas
      UPDATE dbo.RolesUsuario SET AsignadoPor = NULL WHERE AsignadoPor IN (SELECT Id FROM @UserIds);
      UPDATE dbo.SolicitudesAcceso SET IdPropietario = NULL WHERE IdPropietario IN (SELECT Id FROM @UserIds);
      UPDATE dbo.Revisiones SET IdSolicitante = NULL WHERE IdSolicitante IN (SELECT Id FROM @UserIds);
      UPDATE dbo.Revisiones SET IdRevisor = NULL WHERE IdRevisor IN (SELECT Id FROM @UserIds);
      UPDATE dbo.Compartidos SET IdComparte = NULL WHERE IdComparte IN (SELECT Id FROM @UserIds);
      UPDATE dbo.Compartidos SET IdUsuarioDestino = NULL WHERE IdUsuarioDestino IN (SELECT Id FROM @UserIds);
      UPDATE dbo.Proyectos SET IdPropietario = NULL WHERE IdOrganizacion = @orgId;
      UPDATE dbo.Carpetas SET IdPropietario = NULL WHERE IdProyecto IN (SELECT Id FROM @ProjectIds);
      UPDATE dbo.Archivos SET IdPropietario = NULL WHERE IdProyecto IN (SELECT Id FROM @ProjectIds);
      UPDATE dbo.VersionesArchivo SET IdCargador = NULL WHERE IdCargador IN (SELECT Id FROM @UserIds);
      UPDATE dbo.TemasProyecto SET IdCreador = NULL WHERE IdCreador IN (SELECT Id FROM @UserIds);
      UPDATE dbo.Reuniones SET IdCreador = NULL WHERE IdCreador IN (SELECT Id FROM @UserIds);
      UPDATE dbo.ActasReunion SET IdCreador = NULL WHERE IdCreador IN (SELECT Id FROM @UserIds);
      UPDATE dbo.RecursosExternos SET IdCreador = NULL WHERE IdCreador IN (SELECT Id FROM @UserIds);

      -- Eliminar dependencias que referencian a proyectos/archivos de la org
      DELETE FROM dbo.Compartidos WHERE (IdRecurso IN (SELECT Id FROM @ProjectIds) AND TipoRecurso = 'PROJECT')
        OR (IdRecurso IN (SELECT Id FROM dbo.Carpetas WHERE IdProyecto IN (SELECT Id FROM @ProjectIds)) AND TipoRecurso = 'FOLDER')
        OR (IdRecurso IN (SELECT Id FROM dbo.Archivos WHERE IdProyecto IN (SELECT Id FROM @ProjectIds)) AND TipoRecurso = 'FILE');

      DELETE FROM dbo.MiembrosProyecto WHERE IdProyecto IN (SELECT Id FROM @ProjectIds);
      DELETE FROM dbo.AsistentesReunion WHERE IdReunion IN (SELECT Id FROM dbo.Reuniones WHERE IdProyecto IN (SELECT Id FROM @ProjectIds));
      DELETE FROM dbo.ActasReunion WHERE IdReunion IN (SELECT Id FROM dbo.Reuniones WHERE IdProyecto IN (SELECT Id FROM @ProjectIds));
      DELETE FROM dbo.Reuniones WHERE IdProyecto IN (SELECT Id FROM @ProjectIds);
      DELETE FROM dbo.TemasProyecto WHERE IdProyecto IN (SELECT Id FROM @ProjectIds);
      DELETE FROM dbo.RecursosExternos WHERE IdProyecto IN (SELECT Id FROM @ProjectIds);
      DELETE FROM dbo.ComentariosArchivos WHERE IdOrganizacion = @orgId;
      DELETE FROM dbo.Comentarios WHERE IdUsuario IN (SELECT Id FROM @UserIds) OR IdUsuario IN (SELECT Id FROM @UserIds);
      DELETE FROM dbo.VersionesArchivo WHERE IdArchivo IN (SELECT Id FROM dbo.Archivos WHERE IdProyecto IN (SELECT Id FROM @ProjectIds));
      DELETE FROM dbo.Archivos WHERE IdProyecto IN (SELECT Id FROM @ProjectIds);
      DELETE FROM dbo.Carpetas WHERE IdProyecto IN (SELECT Id FROM @ProjectIds);
      DELETE FROM dbo.Favoritos WHERE IdOrganizacion = @orgId;
      DELETE FROM dbo.Notificaciones WHERE IdUsuario IN (SELECT Id FROM @UserIds);
      DELETE FROM dbo.ActividadReciente WHERE IdOrganizacion = @orgId;
      DELETE FROM dbo.SolicitudesPendientes WHERE IdUsuario IN (SELECT Id FROM @UserIds);
      DELETE FROM dbo.SolicitudesAcceso WHERE IdPropietario IN (SELECT Id FROM @UserIds);
      DELETE FROM dbo.RolesUsuario WHERE IdOrganizacion = @orgId OR IdUsuario IN (SELECT Id FROM @UserIds) OR IdRol IN (SELECT Id FROM @RoleIds);
      DELETE FROM dbo.Roles WHERE IdOrganizacion = @orgId;
      DELETE FROM dbo.Usuarios WHERE IdOrganizacion = @orgId;
      DELETE FROM dbo.Proyectos WHERE IdOrganizacion = @orgId;
      DELETE FROM dbo.Auditoria WHERE IdOrganizacion = @orgId;

      DELETE FROM dbo.Organizaciones WHERE Id = @orgId;
    `)

    await tx.commit()
  } catch (e) {
    try { await tx.rollback() } catch { /* ignore */ }
    throw e
  }

  try {
    await logAuditRecord({
      organizationId: actorAuth.organizationId,
      userId: actorAuth.userId,
      action: 'ORG_DELETED_PERMANENT',
      resourceType: 'ORGANIZATION',
      resourceId: orgId,
      resourceName: orgName,
      req: req ?? null,
    })
  } catch {}
}
