import api from './api'
import type { ApiResponse, PaginatedData } from './projects.service'

export interface ApiFile {
  id: string
  folderId: string | null
  projectId: string
  projectName?: string | null
  ownerId: string
  ownerName: string | null
  ownerEmail: string | null
  name: string
  extension: string | null
  mimeType: string | null
  sizeBytes: number
  storageKey: string
  storageProvider: 'local' | 's3'
  downloadUrl: string
  s3Bucket: string | null
  s3ETag: string | null
  s3VersionId: string | null
  checksumSHA256: string | null
  currentVersionId: string | null
  currentVersionNumber: number | null
  versionCount: number | null
  createdAt: string
  updatedAt: string | null
}

export interface ApiFileVersion {
  id: string
  fileId: string
  versionNumber: number
  s3Bucket: string | null
  s3Key: string | null
  hash: string | null
  uploadedBy: string | null
  uploadedByName: string | null
  uploadedByEmail: string | null
  comment: string | null
  size: number | null
  createdAt: string
  downloadUrl: string
}

export type ApiFileType = 'folder' | 'file' | 'video' | 'audio' | 'image' | 'pdf' | 'doc' | 'sheet' | 'slide' | 'zip' | 'link'

export function fileKind(f: ApiFile): ApiFileType {
  const ext = (f.extension || '').toLowerCase()
  const mime = (f.mimeType || '').toLowerCase()
  if (f.storageKey.toLowerCase().startsWith('http') || /^(https?:\/\/|www\.)/i.test(f.name)) return 'link'
  if (mime.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv'].includes(ext)) return 'video'
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'].includes(ext)) return 'audio'
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tif', 'tiff'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(ext) || mime.includes('word') || mime.includes('opendocument.text')) return 'doc'
  if (['xls', 'xlsx', 'csv', 'ods', 'numbers'].includes(ext) || mime.includes('excel') || mime.includes('spreadsheet')) return 'sheet'
  if (['ppt', 'pptx', 'odp', 'key'].includes(ext) || mime.includes('powerpoint') || mime.includes('presentation')) return 'slide'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mime.startsWith('application/zip') || mime.includes('compressed') || mime.includes('x-tar')) return 'zip'
  return 'file'
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const v = bytes / Math.pow(1024, i)
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

export async function fetchFiles(params: {
  projectId?: string
  folderId?: string | null
  search?: string
  page?: number
  pageSize?: number
  mine?: boolean
}) {
  const query = new URLSearchParams()
  if (params.projectId) query.set('projectId', params.projectId)
  if (params.folderId) query.set('folderId', params.folderId)
  if (params.search) query.set('search', params.search)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  if (params.mine) query.set('mine', 'true')
  const res = await api.get<ApiResponse<PaginatedData<ApiFile>>>(`/archivos?${query.toString()}`)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudieron cargar los archivos')
  }
  return res.data.data
}

export async function fetchFileById(id: string): Promise<ApiFile> {
  const res = await api.get<ApiResponse<ApiFile>>(`/archivos/${id}`)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo cargar el archivo')
  }
  return res.data.data
}

export async function deleteFile(id: string) {
  const res = await api.delete(`/archivos/${id}`)
  if (res.status !== 204) {
    throw new Error('No se pudo eliminar el archivo')
  }
}

export async function updateFile(
  id: string,
  patch: { folderId?: string | null; name?: string }
): Promise<ApiFile> {
  const res = await api.patch<ApiResponse<ApiFile>>(`/archivos/${id}`, patch)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo actualizar el archivo')
  }
  return res.data.data
}

export async function moveFile(
  id: string,
  targetFolderId: string | null
): Promise<ApiFile> {
  return updateFile(id, { folderId: targetFolderId })
}

export async function copyFile(
  id: string,
  opts: { targetFolderId?: string | null; name?: string }
): Promise<ApiFile> {
  const res = await api.post<ApiResponse<ApiFile>>(`/archivos/${id}/copy`, {
    targetFolderId: opts.targetFolderId === undefined ? undefined : opts.targetFolderId ?? null,
    name: opts.name,
  })
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo copiar el archivo')
  }
  return res.data.data
}

export interface ApiFileComment {
  id: string
  fileId: string
  projectId: string
  userId: string
  content: string
  parentId: string | null
  createdAt: string
  userFullName?: string | null
  userEmail?: string | null
}

export async function commentFile(
  id: string,
  content: string,
  opts?: { parentId?: string | null }
): Promise<ApiFileComment> {
  const res = await api.post<ApiResponse<ApiFileComment>>(`/archivos/${id}/comentarios`, {
    content,
    parentId: opts?.parentId ?? null,
  })
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo publicar el comentario')
  }
  return res.data.data
}

export async function listFileComments(id: string): Promise<ApiFileComment[]> {
  const res = await api.get<ApiResponse<ApiFileComment[]>>(`/archivos/${id}/comentarios`)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo cargar los comentarios')
  }
  return res.data.data
}

export async function uploadFile(params: {
  projectId: string
  folderId?: string | null
  file: File
  onProgress?: (percent: number) => void
}) {
  const data = new FormData()
  data.append('projectId', params.projectId)
  if (params.folderId) data.append('folderId', params.folderId)
  data.append('file', params.file)
  const res = await api.post<ApiResponse<ApiFile>>('/archivos', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (ev) => {
      if (!params.onProgress || !ev.total) return
      params.onProgress(Math.min(100, Math.round((ev.loaded * 100) / ev.total)))
    },
  })
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo subir el archivo')
  }
  return res.data.data
}

export async function fetchFileVersions(fileId: string): Promise<ApiFileVersion[]> {
  const res = await api.get<ApiResponse<ApiFileVersion[]>>(`/archivos/${fileId}/versiones`)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudieron cargar las versiones')
  }
  return res.data.data
}

export async function fetchFileVersion(fileId: string, versionId: string): Promise<ApiFileVersion> {
  const res = await api.get<ApiResponse<ApiFileVersion>>(`/archivos/${fileId}/versiones/${versionId}`)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo cargar la versión')
  }
  return res.data.data
}

export async function uploadFileVersion(params: {
  fileId: string
  file: File
  comment?: string
  onProgress?: (percent: number) => void
}): Promise<ApiFileVersion> {
  const data = new FormData()
  if (params.comment) data.append('comment', params.comment)
  data.append('file', params.file)
  const res = await api.post<ApiResponse<ApiFileVersion>>(`/archivos/${params.fileId}/versiones`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (ev) => {
      if (!params.onProgress || !ev.total) return
      params.onProgress(Math.min(100, Math.round((ev.loaded * 100) / ev.total)))
    },
  })
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo subir la nueva versión')
  }
  return res.data.data
}

export async function setFileCurrentVersion(fileId: string, versionId: string): Promise<ApiFile> {
  const res = await api.patch<ApiResponse<ApiFile>>(`/archivos/${fileId}/versiones/${versionId}/actual`)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo establecer la versión actual')
  }
  return res.data.data
}

export async function deleteFileVersion(fileId: string, versionId: string): Promise<void> {
  const res = await api.delete(`/archivos/${fileId}/versiones/${versionId}`)
  if (res.status !== 204) {
    throw new Error('No se pudo eliminar la versión')
  }
}
