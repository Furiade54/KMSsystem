import { getDbPool, sql } from './pool'
import type { Request } from 'express'

let ensured = false

export async function ensureAuditAndCommentTables(): Promise<void> {
  if (ensured) return
  try {
    const pool = await getDbPool()
    await pool.request().batch(`
      IF OBJECT_ID('dbo.Comentarios', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.Comentarios (
          Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          TipoRecurso VARCHAR(20) NOT NULL,
          IdRecurso UNIQUEIDENTIFIER NOT NULL,
          IdUsuario UNIQUEIDENTIFIER NOT NULL,
          IdComentarioPadre UNIQUEIDENTIFIER NULL,
          Contenido NVARCHAR(MAX) NOT NULL,
          Resuelto BIT DEFAULT 0,
          FechaCreacion DATETIME2 DEFAULT GETDATE(),
          FechaActualizacion DATETIME2
        );
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Comentarios_IdRecurso' AND object_id = OBJECT_ID('dbo.Comentarios'))
          CREATE INDEX IX_Comentarios_IdRecurso ON dbo.Comentarios(IdRecurso);
      END

      IF OBJECT_ID('dbo.Auditoria', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.Auditoria (
          Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          IdOrganizacion UNIQUEIDENTIFIER,
          IdUsuario UNIQUEIDENTIFIER,
          Accion VARCHAR(100) NOT NULL,
          TipoRecurso VARCHAR(50),
          IdRecurso UNIQUEIDENTIFIER,
          Ip VARCHAR(50),
          AgenteUsuario NVARCHAR(500),
          Metadatos NVARCHAR(MAX),
          FechaCreacion DATETIME2 DEFAULT GETDATE()
        );
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Auditoria_FechaCreacion' AND object_id = OBJECT_ID('dbo.Auditoria'))
          CREATE NONCLUSTERED INDEX IX_Auditoria_FechaCreacion ON dbo.Auditoria(FechaCreacion DESC);
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Auditoria_Accion' AND object_id = OBJECT_ID('dbo.Auditoria'))
          CREATE NONCLUSTERED INDEX IX_Auditoria_Accion ON dbo.Auditoria(Accion);
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Auditoria_TipoRecurso_IdRecurso' AND object_id = OBJECT_ID('dbo.Auditoria'))
          CREATE NONCLUSTERED INDEX IX_Auditoria_TipoRecurso_IdRecurso ON dbo.Auditoria(TipoRecurso, IdRecurso);
      END
    `)
    ensured = true
  } catch {
    /* ignore; run on startup best-effort */
  }
}

function readRequestTrace(req?: Request | null): { ip: string | null; ua: string | null } {
  if (!req) return { ip: null, ua: null }
  try {
    let ip: string | null =
      (req.headers && (req.headers['x-forwarded-for'] as string)) ||
      (req.ip as string) ||
      null
    if (ip && ip.includes(',')) ip = ip.split(',')[0].trim()
    if (ip && ip.length > 50) ip = ip.slice(0, 50)
    const uaRaw = (req.headers && (req.headers['user-agent'] as string)) || null
    const ua = uaRaw ? uaRaw.slice(0, 500) : null
    return { ip, ua }
  } catch {
    return { ip: null, ua: null }
  }
}

export async function logAuditRecord(params: {
  organizationId: string
  userId: string
  action: string
  resourceType: string
  resourceId: string | null
  resourceName?: string | null
  extra?: Record<string, unknown> | null
  req?: Request | null
}): Promise<void> {
  try {
    await ensureAuditAndCommentTables()
    const pool = await getDbPool()
    const metadataRaw: Record<string, unknown> = {
      ...(params.resourceName != null ? { resourceName: String(params.resourceName) } : {}),
      ...(params.extra ?? {}),
    }
    const metadataStr = Object.keys(metadataRaw).length > 0 ? JSON.stringify(metadataRaw) : null
    const trace = readRequestTrace(params.req ?? null)
    const q = pool.request()
    q.input('orgId', sql.UniqueIdentifier, params.organizationId)
    q.input('userId', sql.UniqueIdentifier, params.userId)
    q.input('accion', sql.VarChar(100), String(params.action ?? '').slice(0, 100))
    q.input('tipo', sql.VarChar(50), String(params.resourceType ?? '').slice(0, 50) || null)
    q.input('rid', sql.UniqueIdentifier, params.resourceId || null)
    q.input('ip', sql.VarChar(50), trace.ip ? trace.ip.slice(0, 50) : null)
    q.input('ua', sql.NVarChar(500), trace.ua ? trace.ua.slice(0, 500) : null)
    q.input('meta', sql.NVarChar(sql.MAX), metadataStr)
    await q.query(`
      INSERT INTO Auditoria (IdOrganizacion, IdUsuario, Accion, TipoRecurso, IdRecurso, Ip, AgenteUsuario, Metadatos)
      VALUES (@orgId, @userId, @accion, @tipo, @rid, @ip, @ua, @meta);
    `)
  } catch {
    /* auditoría es best-effort; nunca debe romper el flujo principal */
  }
}

export function truncateForActivity(text: string, max = 280): string {
  if (!text) return ''
  const cleaned = String(text).replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  return cleaned.slice(0, max - 1).trimEnd() + '…'
}

export function resolveAuditProjectIdExpr(): string {
  return `CASE LOWER(a.TipoRecurso)
    WHEN 'project' THEN CAST(a.IdRecurso AS NVARCHAR(128))
    WHEN 'folder'  THEN CAST(f.IdProyecto  AS NVARCHAR(128))
    WHEN 'file'    THEN CAST(af.IdProyecto AS NVARCHAR(128))
    ELSE NULL END`
}
