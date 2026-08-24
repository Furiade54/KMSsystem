import { env } from '../config/env'

if (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes('tls-min-v1')) {
  const prev = process.env.NODE_OPTIONS ?? ''
  process.env.NODE_OPTIONS = (prev + ' --tls-min-v1.0 --tls-max-v1.2').trim()
}

import * as tls from 'node:tls'

try {
  const tlsAny = tls as unknown as {
    DEFAULT_MIN_VERSION?: string
    DEFAULT_MAX_VERSION?: string
    createSecureContext: typeof tls.createSecureContext
    _kmsPatched?: boolean
  }
  if (typeof tlsAny.DEFAULT_MIN_VERSION !== 'undefined') {
    tlsAny.DEFAULT_MIN_VERSION = 'TLSv1'
  }
  if (typeof tlsAny.DEFAULT_MAX_VERSION !== 'undefined') {
    tlsAny.DEFAULT_MAX_VERSION = 'TLSv1.2'
  }
  if (!tlsAny._kmsPatched) {
    tlsAny._kmsPatched = true
    const original = tlsAny.createSecureContext
    tlsAny.createSecureContext = function (options) {
      return original.call(tls, {
        ...(options ?? {}),
        minVersion: 'TLSv1',
        maxVersion: 'TLSv1.2',
        secureOptions: 0,
      })
    } as typeof tls.createSecureContext
  }
} catch {
  /* ignore */
}

const sql = require('mssql') as typeof import('mssql')

let pool: import('mssql').ConnectionPool | null = null

export function getSqlInstanceName() {
  return env.SQL_INSTANCE_NAME && env.SQL_INSTANCE_NAME.trim().length > 0
    ? env.SQL_INSTANCE_NAME.trim()
    : undefined
}

export function buildSqlConfig(): import('mssql').config {
  const instanceName = getSqlInstanceName()
  return {
    server: env.SQL_SERVER,
    database: env.SQL_DATABASE,
    user: env.SQL_USER,
    password: env.SQL_PASSWORD,
    ...(instanceName
      ? {
          options: {
            instanceName,
            encrypt: false,
            trustServerCertificate: true,
            enableArithAbort: true,
            requestTimeout: 60_000,
            connectTimeout: 15_000,
            cancelTimeout: 5000,
            useUTC: false,
            cryptoCredentialsDetails: {
              minVersion: 'TLSv1',
              maxVersion: 'TLSv1.2',
            } as Record<string, unknown>,
          },
        }
      : {
          port: env.SQL_PORT,
          options: {
            encrypt: false,
            trustServerCertificate: true,
            enableArithAbort: true,
            requestTimeout: 60_000,
            connectTimeout: 15_000,
            cancelTimeout: 5000,
            useUTC: false,
            cryptoCredentialsDetails: {
              minVersion: 'TLSv1',
              maxVersion: 'TLSv1.2',
            } as Record<string, unknown>,
          },
        }),
    pool: {
      max: 20,
      min: 2,
      idleTimeoutMillis: 30_000,
      acquireTimeoutMillis: 15_000,
      createTimeoutMillis: 15_000,
      destroyTimeoutMillis: 5000,
    },
  }
}

export function getCurrentSqlConfig() {
  return buildSqlConfig()
}

const renderTarget = () => {
  const instanceName = getSqlInstanceName()
  return instanceName
    ? `${env.SQL_SERVER}\\${instanceName} / ${env.SQL_DATABASE}`
    : `${env.SQL_SERVER}:${env.SQL_PORT} / ${env.SQL_DATABASE}`
}

export async function getDbPool(): Promise<import('mssql').ConnectionPool> {
  if (!pool) {
    const target = renderTarget()
    const cfg = buildSqlConfig()
    try {
      pool = await sql.connect(cfg)
      console.log(`✓ Conectado a SQL Server: ${target}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const tls = msg.toLowerCase().includes('ssl') || msg.toLowerCase().includes('tls')
      console.warn(
        `⚠️  No se pudo conectar a SQL Server [${target}]. Algunas funciones estarán deshabilitadas.`
      )
      console.warn(`   Detalle: ${msg.split('\n')[0]}`)
      if (tls) {
        console.warn('   El servidor usa TLS antiguo. Verifica:')
        console.warn('    - Tienes configurado encrypt=false (SI)')
        console.warn('    - Instancia SQL Server permite login SQL')
      }
      if (env.NODE_ENV === 'development') {
        console.warn('   Continuando en modo sin DB (usando datos mock).')
      } else {
        throw err
      }
    }
  }
  if (!pool) {
    throw new Error('Pool de BD no disponible')
  }
  return pool
}

export async function rebuildDbPool(): Promise<{ ok: boolean; message: string; version?: string }> {
  try {
    if (pool) {
      try {
        await pool.close()
      } catch {
        /* ignore */
      }
      pool = null
    }
    const cfg = buildSqlConfig()
    const p = await sql.connect(cfg)
    pool = p
    const result = await p.query(`SELECT @@VERSION AS [version]`)
    const version = String(result.recordset?.[0]?.version ?? 'desconocida').split('\n')[0]
    const target = renderTarget()
    console.log(`♻️  Pool SQL reconstruido: ${target}`)
    return { ok: true, message: 'Conexión exitosa', version }
  } catch (err) {
    pool = null
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: msg }
  }
}

export async function testDbConnection(
  override?: Partial<{ server: string; port: number; instance: string; database: string; user: string; password: string; encrypt: boolean }>
): Promise<{ ok: boolean; message: string; version?: string }> {
  let poolToClose: import('mssql').ConnectionPool | null = null
  try {
    let cfg: import('mssql').config
    if (override) {
      const instanceName = override.instance && override.instance.trim().length > 0 ? override.instance.trim() : undefined
      cfg = {
        server: override.server ?? env.SQL_SERVER,
        database: override.database ?? env.SQL_DATABASE,
        user: override.user ?? env.SQL_USER,
        password: override.password ?? env.SQL_PASSWORD,
        ...(instanceName
          ? {
              options: {
                instanceName,
                encrypt: !!override.encrypt,
                trustServerCertificate: true,
                enableArithAbort: true,
                requestTimeout: 60_000,
                connectTimeout: 15_000,
                cancelTimeout: 5000,
                useUTC: false,
                cryptoCredentialsDetails: { minVersion: 'TLSv1', maxVersion: 'TLSv1.2' } as Record<string, unknown>,
              },
            }
          : {
              port: override.port ?? env.SQL_PORT,
              options: {
                encrypt: !!override.encrypt,
                trustServerCertificate: true,
                enableArithAbort: true,
                requestTimeout: 60_000,
                connectTimeout: 15_000,
                cancelTimeout: 5000,
                useUTC: false,
                cryptoCredentialsDetails: { minVersion: 'TLSv1', maxVersion: 'TLSv1.2' } as Record<string, unknown>,
              },
            }),
      }
    } else {
      cfg = buildSqlConfig()
    }
    const p = await sql.connect(cfg)
    poolToClose = p
    const result = await p.query(`SELECT @@VERSION AS [version]`)
    const version = String(result.recordset?.[0]?.version ?? 'desconocida').split('\n')[0]
    await p.close()
    return { ok: true, message: 'Conexión exitosa', version }
  } catch (err) {
    if (poolToClose) {
      try {
        await poolToClose.close()
      } catch {
        /* ignore */
      }
    }
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: msg }
  }
}

export async function closeDbPool() {
  if (pool) {
    await pool.close()
    pool = null
    console.log('🔌 Conexión SQL cerrada.')
  }
}

export { sql }
export const sqlInstanceName = getSqlInstanceName()
export const sqlConfig = buildSqlConfig()
