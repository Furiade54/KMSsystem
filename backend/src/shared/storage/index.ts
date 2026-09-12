import * as fs from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'
import { Readable } from 'node:stream'
import { env } from '../config/env'

export interface StoragePutOptions {
  contentType?: string
  metadata?: Record<string, string>
}

export interface StoragePutResult {
  etag?: string
  sizeBytes: number
  versionId?: string
}

export interface StorageHeadResult {
  contentType?: string
  contentLength?: number
}

export interface StorageProvider {
  name: 'local' | 's3'
  putObject(key: string, buffer: Buffer, opts?: StoragePutOptions): Promise<StoragePutResult>
  getObject(key: string): Promise<Buffer | null>
  getObjectStream(key: string): Promise<Readable | null>
  headObject(key: string): Promise<StorageHeadResult | null>
  deleteObject(key: string): Promise<void>
  getPresignedDownloadUrl(key: string): Promise<string>
  ensureBucket?(): Promise<void>
}

let _provider: StorageProvider | null = null

export function invalidateStorageProvider() {
  _provider = null
}

function sanitizeKey(key: string): string {
  return String(key || '').replace(/\\/g, '/').replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/')
}

function localBasePath(): string {
  const p = env.STORAGE_LOCAL_PATH || './storage'
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p)
}

function localFullPath(key: string): string {
  return path.join(localBasePath(), sanitizeKey(key))
}

function ensureParentDir(filePath: string) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function buildLocalSignedUrl(key: string): string {
  const ttl = env.AWS_S3_PRESIGNED_EXPIRES_IN || 900
  const exp = Math.floor(Date.now() / 1000) + ttl
  const toSign = `${exp}:${key}`
  const sig = crypto.createHmac('sha256', env.JWT_SECRET).update(toSign).digest('hex')
  return `/api/archivos/local/${encodeURIComponent(key)}?exp=${exp}&sig=${sig}`
}

function createLocalProvider(): StorageProvider {
  return {
    name: 'local',

    async putObject(key: string, buffer: Buffer, _opts?: StoragePutOptions): Promise<StoragePutResult> {
      const full = localFullPath(key)
      ensureParentDir(full)
      fs.writeFileSync(full, buffer)
      const etag = `"${crypto.createHash('md5').update(buffer).digest('hex')}"`
      return { etag, sizeBytes: buffer.length }
    },

    async getObject(key: string): Promise<Buffer | null> {
      const full = localFullPath(key)
      if (!fs.existsSync(full)) return null
      return fs.readFileSync(full)
    },

    async getObjectStream(key: string): Promise<Readable | null> {
      const full = localFullPath(key)
      if (!fs.existsSync(full)) return null
      return fs.createReadStream(full)
    },

    async headObject(key: string): Promise<StorageHeadResult | null> {
      const full = localFullPath(key)
      if (!fs.existsSync(full)) return null
      const st = fs.statSync(full)
      return { contentLength: st.size }
    },

    async deleteObject(key: string): Promise<void> {
      const full = localFullPath(key)
      if (fs.existsSync(full)) fs.rmSync(full, { force: true })
    },

    async getPresignedDownloadUrl(key: string): Promise<string> {
      return buildLocalSignedUrl(key)
    },
  }
}

let _S3ClientCtor: any = null
let _S3GetObjectCommand: any = null
let _S3PutObjectCommand: any = null
let _S3DeleteObjectCommand: any = null
let _S3HeadObjectCommand: any = null
let _S3CreateBucketCommand: any = null
let _S3HeadBucketCommand: any = null
let _getSignedUrlFn: any = null

async function lazyLoadS3() {
  if (_S3ClientCtor) return
  const s3mod = await import('@aws-sdk/client-s3')
  const signmod = await import('@aws-sdk/s3-request-presigner')
  _S3ClientCtor = s3mod.S3Client
  _S3GetObjectCommand = s3mod.GetObjectCommand
  _S3PutObjectCommand = s3mod.PutObjectCommand
  _S3DeleteObjectCommand = s3mod.DeleteObjectCommand
  _S3HeadObjectCommand = s3mod.HeadObjectCommand
  _S3CreateBucketCommand = s3mod.CreateBucketCommand
  _S3HeadBucketCommand = s3mod.HeadBucketCommand
  _getSignedUrlFn = signmod.getSignedUrl
}

function s3ClientConfig() {
  const cfg: any = { region: env.AWS_REGION || 'us-east-1' }
  if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
    cfg.credentials = {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    }
  }
  return cfg
}

async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

function createS3Provider(): StorageProvider {
  let clientPromise: Promise<any> | null = null

  const getClient = async () => {
    if (!clientPromise) {
      clientPromise = (async () => {
        await lazyLoadS3()
        return new _S3ClientCtor(s3ClientConfig())
      })()
    }
    return clientPromise
  }

  const bucket = () => env.AWS_S3_BUCKET || ''

  return {
    name: 's3',

    async ensureBucket(): Promise<void> {
      if (!bucket()) throw new Error('AWS_S3_BUCKET no configurado')
      const client = await getClient()
      try {
        await client.send(new _S3HeadBucketCommand({ Bucket: bucket() }))
      } catch (e: any) {
        if (e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404) {
          await client.send(new _S3CreateBucketCommand({
            Bucket: bucket(),
            CreateBucketConfiguration: env.AWS_REGION && env.AWS_REGION !== 'us-east-1'
              ? { LocationConstraint: env.AWS_REGION }
              : undefined,
          }))
        } else {
          throw e
        }
      }
    },

    async putObject(key: string, buffer: Buffer, opts?: StoragePutOptions): Promise<StoragePutResult> {
      if (!bucket()) throw new Error('AWS_S3_BUCKET no configurado')
      const client = await getClient()
      const res = await client.send(new _S3PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: buffer,
        ContentType: opts?.contentType,
        Metadata: opts?.metadata,
      }))
      return {
        etag: res.ETag,
        sizeBytes: buffer.length,
        versionId: res.VersionId,
      }
    },

    async getObject(key: string): Promise<Buffer | null> {
      if (!bucket()) throw new Error('AWS_S3_BUCKET no configurado')
      const client = await getClient()
      try {
        const res = await client.send(new _S3GetObjectCommand({ Bucket: bucket(), Key: key }))
        if (!res.Body) return null
        return await streamToBuffer(res.Body)
      } catch (e: any) {
        if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return null
        throw e
      }
    },

    async getObjectStream(key: string): Promise<Readable | null> {
      if (!bucket()) throw new Error('AWS_S3_BUCKET no configurado')
      const client = await getClient()
      try {
        const res = await client.send(new _S3GetObjectCommand({ Bucket: bucket(), Key: key }))
        if (!res.Body) return null
        return Readable.from(res.Body as any)
      } catch (e: any) {
        if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return null
        throw e
      }
    },

    async headObject(key: string): Promise<StorageHeadResult | null> {
      if (!bucket()) throw new Error('AWS_S3_BUCKET no configurado')
      const client = await getClient()
      try {
        const res = await client.send(new _S3HeadObjectCommand({ Bucket: bucket(), Key: key }))
        return {
          contentType: res.ContentType,
          contentLength: Number(res.ContentLength || 0),
        }
      } catch (e: any) {
        if (e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404) return null
        throw e
      }
    },

    async deleteObject(key: string): Promise<void> {
      if (!bucket()) throw new Error('AWS_S3_BUCKET no configurado')
      const client = await getClient()
      await client.send(new _S3DeleteObjectCommand({ Bucket: bucket(), Key: key }))
    },

    async getPresignedDownloadUrl(key: string): Promise<string> {
      if (!bucket()) throw new Error('AWS_S3_BUCKET no configurado')
      await lazyLoadS3()
      const client = await getClient()
      const cmd = new _S3GetObjectCommand({ Bucket: bucket(), Key: key })
      const expiresIn = Number(env.AWS_S3_PRESIGNED_EXPIRES_IN || 900)
      return _getSignedUrlFn(client, cmd, { expiresIn })
    },
  }
}

export function createStorageProvider(): StorageProvider {
  const kind = env.STORAGE_PROVIDER || 'local'
  _provider = kind === 's3' ? createS3Provider() : createLocalProvider()
  return _provider
}

export function getStorageProvider(): StorageProvider {
  if (!_provider) return createStorageProvider()
  return _provider
}
