import type { ConnectionPool } from 'mssql'
import { sql } from '../../shared/db/pool'
import { NotFoundError, BadRequestError } from '../../shared/errors/AppError'

export interface Organization extends Record<string, unknown> {
  id: string
  name: string
  nit?: string | null
  logoUrl?: string | null
  status: string
  createdAt: string
  updatedAt?: string | null
}

function mapOrg(row: any): Organization {
  return {
    id: String(row.Id),
    name: row.Nombre,
    nit: row.NIT ?? null,
    logoUrl: row.LogoUrl ?? null,
    status: row.Estado,
    createdAt: row.FechaCreacion?.toISOString?.() ?? new Date(row.FechaCreacion).toISOString(),
    updatedAt: row.FechaActualizacion
      ? row.FechaActualizacion.toISOString?.() ?? new Date(row.FechaActualizacion).toISOString()
      : null,
  }
}

export async function getOrganizationById(
  pool: ConnectionPool,
  organizationId: string
): Promise<Organization> {
  const { recordset } = await pool
    .request()
    .input('id', sql.UniqueIdentifier, organizationId)
    .query(
      `SELECT Id, Nombre, NIT, LogoUrl, Estado, FechaCreacion, FechaActualizacion
       FROM dbo.Organizaciones
       WHERE Id = @id`
    )
  if (recordset.length === 0) throw new NotFoundError('Organización no encontrada')
  return mapOrg(recordset[0])
}

export async function updateOrganization(
  pool: ConnectionPool,
  organizationId: string,
  patch: { name?: string; nit?: string | null; logoUrl?: string | null; status?: string }
): Promise<Organization> {
  const current = await getOrganizationById(pool, organizationId)
  const name = (patch.name ?? current.name).trim()
  if (!name) throw new BadRequestError('Nombre es requerido')
  if (patch.status !== undefined && !['ACTIVO', 'INACTIVO'].includes(patch.status)) {
    throw new BadRequestError('Estado inválido')
  }
  const nit = patch.nit !== undefined ? patch.nit : current.nit
  const logoUrl = patch.logoUrl !== undefined ? patch.logoUrl : current.logoUrl
  const status = patch.status ?? current.status
  await pool
    .request()
    .input('id', sql.UniqueIdentifier, organizationId)
    .input('nombre', sql.NVarChar(200), name)
    .input('nit', sql.NVarChar(50), nit ?? null)
    .input('logoUrl', sql.NVarChar(Number.MAX_SAFE_INTEGER), logoUrl ?? null)
    .input('estado', sql.VarChar(20), status)
    .query(
      `UPDATE dbo.Organizaciones
       SET Nombre = @nombre,
           NIT = @nit,
           LogoUrl = @logoUrl,
           Estado = @estado,
           FechaActualizacion = SYSUTCDATETIME()
       WHERE Id = @id`
    )
  return getOrganizationById(pool, organizationId)
}
