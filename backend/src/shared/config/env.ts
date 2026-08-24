import { config as loadDotenv } from 'dotenv'
import { z } from 'zod'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const ENV_FILE_PATH = path.resolve(process.cwd(), '.env')

const DEV_JWT_SECRET = 'dev-secret-change-me-please-0123456789'
const DEV_SQL_PASSWORD = 'DevP@ss123'
const isDevEnv = (process.env.NODE_ENV ?? 'development') !== 'production'

function buildSchema() {
  return z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(51478),
    JWT_SECRET: isDevEnv
      ? z.string().min(10).default(DEV_JWT_SECRET)
      : z.string().min(10),
    JWT_EXPIRES_IN: z.string().default('24h'),
    SQL_SERVER: z.string().default('localhost'),
    SQL_INSTANCE_NAME: z.string().optional(),
    SQL_PORT: z.coerce.number().default(1433),
    SQL_DATABASE: z.string().default('KMS'),
    SQL_USER: z.string().default('sa'),
    SQL_PASSWORD: isDevEnv
      ? z.string().default(DEV_SQL_PASSWORD)
      : z.string(),
    SQL_ENCRYPT: z.coerce.boolean().default(false),
    STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_PATH: z.string().default('./storage'),
    AWS_REGION: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_S3_BUCKET: z.string().optional(),
    AWS_S3_PRESIGNED_EXPIRES_IN: z.coerce.number().default(900),
    CORS_ORIGIN: z.string().default('http://localhost:51479'),
  })
}

type EnvShape = z.infer<ReturnType<typeof buildSchema>>

function parseFromProcess() {
  const schema = buildSchema()
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    console.error('❌ Variables de entorno inválidas:')
    parsed.error.issues.forEach((i) => console.error(`   - ${i.path.join('.')}: ${i.message}`))
    if (!isDevEnv) process.exit(1)
    const fallback = schema.parse(process.env)
    return { data: fallback, warning: true }
  }
  return { data: parsed.data, warning: false }
}

const bootstrapInitial = (() => {
  if (!process.env.__KMS_DOTENV_LOADED) {
    loadDotenv()
    process.env.__KMS_DOTENV_LOADED = '1'
  }
  return parseFromProcess()
})()

export const env = { ...bootstrapInitial.data } as EnvShape

function syncEnvObjectFromData(data: EnvShape) {
  for (const k of Object.keys(data) as Array<keyof EnvShape>) {
    ;(env as unknown as Record<string, unknown>)[k] = (data as unknown as Record<string, unknown>)[k]
  }
  for (const k of Object.keys(data) as Array<keyof EnvShape>) {
    const v = (data as unknown as Record<string, unknown>)[k]
    if (v === undefined || v === null) {
      delete process.env[k]
    } else {
      process.env[k] = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v)
    }
  }
}

export async function reloadEnv(): Promise<{ ok: boolean; error?: string }> {
  try {
    if (fs.existsSync(ENV_FILE_PATH)) {
      loadDotenv({ override: true, path: ENV_FILE_PATH })
    }
    const { data, warning } = parseFromProcess()
    syncEnvObjectFromData(data)
    if (warning) console.warn('⚠️  Algunas variables usan valores por defecto tras reload.')
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

function escapeEnvValue(raw: unknown): string {
  const s = raw === undefined || raw === null ? '' : String(raw)
  const needsQuote = /\s|"|'|#|=/.test(s)
  if (!needsQuote) return s
  const escaped = s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"${escaped}"`
}

function writeDotenvFileSync(values: Record<string, unknown>) {
  const groups = [
    { title: 'General', keys: ['PORT', 'NODE_ENV'] as const },
    { title: 'JWT', keys: ['JWT_SECRET', 'JWT_EXPIRES_IN'] as const },
    {
      title: 'SQL Server',
      keys: ['SQL_SERVER', 'SQL_INSTANCE_NAME', 'SQL_PORT', 'SQL_DATABASE', 'SQL_USER', 'SQL_PASSWORD', 'SQL_ENCRYPT'] as const,
    },
    {
      title: 'Almacenamiento',
      keys: ['STORAGE_PROVIDER', 'STORAGE_LOCAL_PATH', 'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET', 'AWS_S3_PRESIGNED_EXPIRES_IN'] as const,
    },
    { title: 'CORS', keys: ['CORS_ORIGIN'] as const },
  ]
  const lines: string[] = []
  for (const group of groups) {
    lines.push(`# ${group.title}`)
    for (const k of group.keys) {
      if (!(k in values)) continue
      const v = values[k as string]
      if (v === undefined || v === null || v === '') {
        lines.push(`# ${k}=`)
        continue
      }
      lines.push(`${k}=${escapeEnvValue(v)}`)
    }
    lines.push('')
  }
  const content = lines.join(os.EOL)
  fs.writeFileSync(ENV_FILE_PATH, content, 'utf8')
}

export async function saveEnv(nextValues: Partial<EnvShape>): Promise<{
  ok: boolean
  error?: string
  applied?: Partial<EnvShape>
}> {
  try {
    const current: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(env)) {
      current[k] = v
    }
    const merged: Record<string, unknown> = { ...current }
    for (const [k, v] of Object.entries(nextValues)) {
      if (v === undefined) continue
      if (v === '__KEEP_CURRENT__') continue
      merged[k] = v
    }
    writeDotenvFileSync(merged)
    const reloaded = await reloadEnv()
    if (!reloaded.ok) {
      return { ok: false, error: reloaded.error ?? 'No se pudieron recargar variables' }
    }
    return { ok: true, applied: Object.fromEntries(Object.entries(nextValues).filter(([, v]) => v !== '__KEEP_CURRENT__')) as Partial<EnvShape> }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

export function getEnvFilePath(): string {
  return ENV_FILE_PATH
}

export const isDev = env.NODE_ENV === 'development'
