import type { Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { uploadFile, listFiles, listAllFiles, getFileById, deleteFileById, verifyLocalDownloadSignature, updateFileById, copyFileById, commentFileById, listFileComments, updateFileCommentById, deleteFileCommentById } from './files.service'
import { getStorageProvider } from '../../shared/storage'
import type { ApiResponse, PaginatedResult } from '../../../../packages/shared-types/src'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
})

export const uploadMiddleware = upload.single('file')

export async function uploadFileEndpoint(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const file = req.file
    const projectId = String(req.body.projectId || '')
    const folderId = req.body.folderId ? String(req.body.folderId) : null
    const result = await uploadFile(auth, file!, { projectId, folderId }, { req })
    res.status(201).json({ success: true, data: result })
  } catch (e) {
    next(e)
  }
}

export async function listFilesEndpoint(
  req: Request,
  res: Response<ApiResponse<PaginatedResult<any>>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectIdRaw = String(req.query.projectId || '')
    const mine = req.query.mine === 'true' || req.query.ownerOnly === 'true'
    const folderId = req.query.folderId ? String(req.query.folderId) : null
    const search = req.query.search ? String(req.query.search) : null
    const page = req.query.page ? Number(req.query.page) : 1
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 50
    let r
    if (!projectIdRaw || projectIdRaw === '') {
      // modo global Mis documentos / Todos documentos
      r = await listAllFiles(auth, { mine, search, page, pageSize: Math.max(1, Math.min(100, Number(req.query.pageSize || 20))) })
    } else {
      r = await listFiles(auth, { projectId: projectIdRaw, folderId, search, page, pageSize })
    }
    const totalPages = r.total === 0 ? 0 : Math.max(1, Math.ceil(r.total / r.pageSize))
    res.status(200).json({
      success: true,
      data: { items: r.items, total: r.total, page: r.page, pageSize: r.pageSize, totalPages },
    })
  } catch (e) {
    next(e)
  }
}

export async function getFileEndpoint(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const r = await getFileById(auth, String(req.params.id))
    res.status(200).json({ success: true, data: r })
  } catch (e) {
    next(e)
  }
}

export async function deleteFileEndpoint(
  req: Request,
  res: Response<ApiResponse<void>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    await deleteFileById(auth, String(req.params.id))
    res.status(204).end()
  } catch (e) {
    next(e)
  }
}

export async function updateFileEndpoint(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const id = String(req.params.id)
    const patch: { folderId?: string | null; name?: string } = {}
    if (req.body && req.body.folderId !== undefined) {
      patch.folderId = req.body.folderId ? String(req.body.folderId) : null
    }
    if (req.body && req.body.name != null) patch.name = String(req.body.name)
    const file = await updateFileById(auth, id, patch, { req })
    res.status(200).json({ success: true, data: file })
  } catch (e) {
    next(e)
  }
}

export async function copyFileEndpoint(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const id = String(req.params.id)
    const targetFolderId =
      req.body && req.body.targetFolderId !== undefined
        ? req.body.targetFolderId
          ? String(req.body.targetFolderId)
          : null
        : undefined
    const name = req.body && req.body.name != null ? String(req.body.name) : undefined
    const file = await copyFileById(auth, id, { targetFolderId, name }, { req })
    res.status(201).json({ success: true, data: file })
  } catch (e) {
    next(e)
  }
}

export async function commentFileEndpoint(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const id = String(req.params.id)
    const content = req.body && req.body.content != null ? String(req.body.content).trim() : ''
    const parentId = req.body && req.body.parentId != null ? String(req.body.parentId).trim() || null : null
    const comment = await commentFileById(auth, id, content, { req, parentId })
    res.status(201).json({ success: true, data: comment })
  } catch (e) {
    next(e)
  }
}

export async function listFileCommentsEndpoint(
  req: Request,
  res: Response<ApiResponse<any[]>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const id = String(req.params.id)
    const items = await listFileComments(auth, id)
    res.status(200).json({ success: true, data: items })
  } catch (e) {
    next(e)
  }
}

type AuthFull = { auth: { organizationId: string; userId: string; isOrgAdmin?: boolean; permissions?: ReadonlySet<string> } }

export async function updateFileCommentEndpoint(
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
) {
  try {
    const { auth } = req as unknown as AuthFull
    const fileId = String(req.params.id)
    const cid = String(req.params.cid)
    const patch: any = req.body ?? {}
    const data = await updateFileCommentById(auth, fileId, cid, {
      content: patch.content,
      resolved: patch.resolved,
    }, { req })
    res.status(200).json({ success: true, data })
  } catch (e) { next(e) }
}

export async function deleteFileCommentEndpoint(
  req: Request,
  res: Response<ApiResponse<void>>,
  next: NextFunction
) {
  try {
    const { auth } = req as unknown as AuthFull
    const fileId = String(req.params.id)
    const cid = String(req.params.cid)
    await deleteFileCommentById(auth, fileId, cid, { req })
    res.status(204).end()
  } catch (e) { next(e) }
}


export async function localDownloadEndpoint(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const v = verifyLocalDownloadSignature(req)
    if (!v.ok || !v.key) {
      return res.status(403).json({ success: false, error: 'Firma inválida o enlace expirado' })
    }
    const storage = getStorageProvider()
    const stream = await storage.getObjectStream(v.key)
    if (!stream) return res.status(404).json({ success: false, error: 'Archivo no encontrado' })
    const head = await storage.headObject(v.key)
    if (head && head.contentType) res.setHeader('Content-Type', head.contentType)
    if (head && typeof head.contentLength === 'number' && Number.isFinite(head.contentLength)) {
      res.setHeader('Content-Length', String(head.contentLength))
    }
    const baseName = v.key.split('/').pop() || 'archivo'
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}"`)
    stream.pipe(res)
  } catch (e) {
    next(e)
  }
}
