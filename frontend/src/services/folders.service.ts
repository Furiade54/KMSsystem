import api from './api'
import type { ApiResponse } from './projects.service'

export interface ApiFolder {
  id: string
  projectId: string
  parentId: string | null
  ownerId: string | null
  name: string
  inheritPermissions: boolean
  filesCount: number
  childrenCount: number
  createdAt: string
  updatedAt: string | null
}

export interface CreateFolderPayload {
  projectId: string
  name: string
  parentId?: string | null
}

export interface FolderNode extends ApiFolder {
  children: FolderNode[]
}

export async function fetchFolders(params: {
  projectId: string
  parentId?: string | null
  rootOnly?: boolean
  includeAll?: boolean
}) {
  const query = new URLSearchParams()
  query.set('projectId', params.projectId)
  if (params.parentId) query.set('parentId', params.parentId)
  if (params.rootOnly) query.set('rootOnly', 'true')
  if (params.includeAll) query.set('includeAll', 'true')
  const res = await api.get<ApiResponse<{ items: ApiFolder[]; total: number }>>(
    `/carpetas?${query.toString()}`
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudieron cargar las carpetas')
  }
  return res.data.data
}

export async function createFolder(payload: CreateFolderPayload) {
  const res = await api.post<ApiResponse<{ folder: ApiFolder }>>('/carpetas', payload)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo crear la carpeta')
  }
  return res.data.data.folder
}

export async function fetchFolderById(id: string): Promise<ApiFolder> {
  const res = await api.get<ApiResponse<ApiFolder>>(`/carpetas/${id}`)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo cargar la carpeta')
  }
  return res.data.data
}

export async function updateFolder(
  id: string,
  patch: { name?: string; parentId?: string | null }
): Promise<ApiFolder> {
  const res = await api.patch<ApiResponse<{ folder: ApiFolder }>>(`/carpetas/${id}`, patch)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo actualizar la carpeta')
  }
  return res.data.data.folder
}

export async function moveFolder(
  id: string,
  targetParentId: string | null
): Promise<ApiFolder> {
  return updateFolder(id, { parentId: targetParentId })
}

export async function copyFolder(id: string, opts: { targetParentId?: string | null; name?: string }): Promise<{ folder: ApiFolder; copiedFolders: number; copiedFiles: number }> {
  const res = await api.post<ApiResponse<{ folder: ApiFolder; copiedFolders: number; copiedFiles: number }>>(`/carpetas/${id}/copy`, {
    targetParentId: opts.targetParentId === undefined ? undefined : opts.targetParentId ?? null,
    name: opts.name,
  })
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo copiar la carpeta')
  }
  return res.data.data
}

export async function deleteFolder(id: string) {
  const res = await api.delete(`/carpetas/${id}`)
  if (res.status !== 204) {
    throw new Error('No se pudo eliminar la carpeta')
  }
}

export function buildFolderTree(flat: ApiFolder[]): FolderNode[] {
  const byId = new Map<string, FolderNode>()
  flat.forEach((f) => byId.set(f.id, { ...f, children: [] }))
  const roots: FolderNode[] = []
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  const sortFn = (a: FolderNode, b: FolderNode) =>
    a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' })
  roots.sort(sortFn)
  byId.forEach((n) => n.children.sort(sortFn))
  return roots
}
