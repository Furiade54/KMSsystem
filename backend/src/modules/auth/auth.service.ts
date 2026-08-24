import { getDbPool, sql } from '../../shared/db/pool'
import { comparePassword, signToken, getTokenExpiration } from '../../shared/auth/crypto'
import { UnauthorizedError, ConflictError } from '../../shared/errors/AppError'
import type { LoginResponse, User } from '../../../../packages/shared-types/src'
import { sqlLocalToIso, sqlLocalToIsoOrNull } from '../../shared/utils/date'

interface RegisterInput {
  fullName: string
  email: string
  password: string
  organizationName: string
}

function mapUser(row: {
  Id: string
  IdOrganizacion: string
  NombreCompleto: string | null
  Correo: string
  UrlAvatar: string | null
  Estado: string
  UltimoInicio: Date | null
  FechaCreacion: Date
  FechaActualizacion: Date | null
}): User {
  const raw = String(row.Estado).toUpperCase()
  const statusMap: Record<string, User['status']> = {
    ACTIVO: 'ACTIVE',
    INACTIVO: 'INACTIVE',
    PENDIENTE: 'PENDING',
    BLOQUEADO: 'BLOCKED',
    ELIMINADO: 'DELETED',
  }
  return {
    id: String(row.Id),
    organizationId: String(row.IdOrganizacion),
    fullName: row.NombreCompleto ?? '',
    email: row.Correo,
    avatarUrl: row.UrlAvatar ?? null,
    status: statusMap[raw] ?? 'ACTIVE',
    lastLogin: sqlLocalToIsoOrNull(row.UltimoInicio as any),
    createdAt: sqlLocalToIso(row.FechaCreacion as any),
    updatedAt: sqlLocalToIsoOrNull(row.FechaActualizacion as any),
  }
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const pool = await getDbPool()
  const req = pool.request()
  req.input('email', sql.NVarChar(200), email)
  const result = await req.query<{
    Id: string
    IdOrganizacion: string
    NombreCompleto: string | null
    Correo: string
    ClaveHash: string
    UrlAvatar: string | null
    Estado: string
    UltimoInicio: Date | null
    FechaCreacion: Date
    FechaActualizacion: Date | null
  }>(`
    SELECT TOP 1
      u.Id, u.IdOrganizacion, u.NombreCompleto, u.Correo, u.ClaveHash, u.UrlAvatar,
      u.Estado, u.UltimoInicio, u.FechaCreacion, u.FechaActualizacion
    FROM Usuarios u
    INNER JOIN Organizaciones o ON o.Id = u.IdOrganizacion
    WHERE LOWER(u.Correo) = LOWER(@email)
      AND u.Estado='ACTIVO' AND o.Estado='ACTIVO'
  `)
  const row = result.recordset[0]
  if (!row) throw new UnauthorizedError('Credenciales inválidas')
  if (!row.ClaveHash) throw new UnauthorizedError('Credenciales inválidas')

  const ok = await comparePassword(password, row.ClaveHash)
  if (!ok) throw new UnauthorizedError('Credenciales inválidas')

  try {
    const upd = pool.request()
    upd.input('userId', sql.UniqueIdentifier, row.Id)
    await upd.query(
      `UPDATE Usuarios SET UltimoInicio=GETDATE(), FechaActualizacion=GETDATE() WHERE Id=@userId`
    )
  } catch {
    /* ignore */
  }

  const token = signToken({
    sub: String(row.Id),
    organizationId: String(row.IdOrganizacion),
    email: row.Correo,
  })
  const expiresAt = getTokenExpiration()
  const user = mapUser(row)
  return {
    token,
    user,
    expiresAt: expiresAt.toISOString(),
  }
}

export async function register(input: RegisterInput): Promise<LoginResponse> {
  const pool = await getDbPool()
  const chk = pool.request()
  chk.input('email', sql.NVarChar(200), input.email)
  const dup = await chk.query(`SELECT Id FROM Usuarios WHERE LOWER(Correo)=LOWER(@email)`)
  if (dup.recordset.length > 0) throw new ConflictError('Ya existe un usuario con ese correo')

  const tx = pool.transaction()
  try {
    await tx.begin()
    const orgId = crypto.randomUUID()
    const userId = crypto.randomUUID()
    await tx
      .request()
      .input('orgId', sql.UniqueIdentifier, orgId)
      .input('orgName', sql.NVarChar(200), input.organizationName).query(`
      INSERT Organizaciones(Id,Nombre,Estado,FechaCreacion,FechaActualizacion)
      VALUES (@orgId,@orgName,'ACTIVO',GETDATE(),GETDATE());
    `)
    const { hashPassword } = await import('../../shared/auth/crypto')
    const passwordHash = await hashPassword(input.password)
    await tx
      .request()
      .input('userId', sql.UniqueIdentifier, userId)
      .input('orgId', sql.UniqueIdentifier, orgId)
      .input('full', sql.NVarChar(150), input.fullName)
      .input('email', sql.NVarChar(200), input.email)
      .input('hash', sql.NVarChar(sql.MAX), passwordHash).query(`
      INSERT Usuarios(Id,IdOrganizacion,NombreCompleto,Correo,ClaveHash,Estado,UltimoInicio,FechaCreacion,FechaActualizacion)
      VALUES (@userId,@orgId,@full,@email,@hash,'ACTIVO',NULL,GETDATE(),GETDATE());
    `)
    await tx.commit()

    const token = signToken({
      sub: userId,
      organizationId: orgId,
      email: input.email,
    })
    const expiresAt = getTokenExpiration()
    const user: User = {
      id: userId,
      organizationId: orgId,
      fullName: input.fullName,
      email: input.email,
      avatarUrl: null,
      status: 'ACTIVE',
      lastLogin: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    return { token, user, expiresAt: expiresAt.toISOString() }
  } catch (e) {
    try {
      await tx.rollback()
    } catch {
      /* ignore */
    }
    throw e
  }
}

export async function getUserById(id: string): Promise<User> {
  const pool = await getDbPool()
  const req = pool.request()
  req.input('id', sql.UniqueIdentifier, id)
  const r = await req.query<{
    Id: string
    IdOrganizacion: string
    NombreCompleto: string | null
    Correo: string
    UrlAvatar: string | null
    Estado: string
    UltimoInicio: Date | null
    FechaCreacion: Date
    FechaActualizacion: Date | null
  }>(`
    SELECT Id,IdOrganizacion,NombreCompleto,Correo,UrlAvatar,Estado,UltimoInicio,FechaCreacion,FechaActualizacion
    FROM Usuarios
    WHERE Id=@id AND Estado='ACTIVO'
  `)
  const row = r.recordset[0]
  if (!row) throw new UnauthorizedError('Usuario no encontrado')
  return mapUser(row)
}
