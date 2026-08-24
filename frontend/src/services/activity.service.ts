import api from './api'
import type { ApiResponse } from './projects.service'
import { formatRelativeTime } from './projects.service'

export interface ActivityItem {
  id: string
  action: string
  resourceType: 'project' | 'folder' | 'file' | 'user' | string
  resourceId: string | null
  resourceName: string | null
  projectId: string | null
  userId: string | null
  userFullName: string | null
  userEmail: string | null
  occurredAt: string
  comment?: string | null
  commentId?: string | null
}

export interface ActivityResponse {
  items: ActivityItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  source: 'auditoria' | 'fallback'
}

export async function fetchActivity(params?: { limit?: number; page?: number; pageSize?: number }) {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.pageSize) query.set('pageSize', String(params.pageSize))
  // backwards compat: si vienen limit sin pageSize, mandar limit por si acaso el backend es viejo
  if (params?.limit && !params?.pageSize) query.set('limit', String(params.limit))
  const qs = query.toString()
  const res = await api.get<ApiResponse<ActivityResponse>>(`/actividad${qs ? `?${qs}` : ''}`)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo cargar la actividad')
  }
  return res.data.data
}

const ACTION_DICTIONARY: Record<string, { phrase: string; boldTarget: boolean; anchorKeyword?: string }> = {
  'file.subido': { phrase: 'subió el documento', boldTarget: true },
  'file.renombrado': { phrase: 'renombró el documento', boldTarget: true },
  'file.movido': { phrase: 'movió el documento', boldTarget: true },
  'file.copiado': { phrase: 'copió el documento', boldTarget: true },
  'folder.creada': { phrase: 'creó la carpeta', boldTarget: true },
  'folder.renombrada': { phrase: 'renombró la carpeta', boldTarget: true },
  'folder.movida': { phrase: 'movió la carpeta', boldTarget: true },
  'folder.copiada': { phrase: 'copió la carpeta', boldTarget: true },
  'project.creado': { phrase: 'creó el proyecto', boldTarget: true },
  'file.comentado': { phrase: 'hizo un comentario sobre el documento', boldTarget: true, anchorKeyword: 'comentario' },
}

function tryDictionary(action: string): { phrase: string; boldTarget: boolean; anchorKeyword?: string } {
  if (ACTION_DICTIONARY[action]) return ACTION_DICTIONARY[action]
  const a = action.toLowerCase()
  if (a.includes('upload') || a.includes('subi')) return { phrase: 'subió el documento', boldTarget: true }
  if (a.includes('comment') || a.includes('coment')) return { phrase: 'hizo un comentario sobre el documento', boldTarget: true, anchorKeyword: 'comentario' }
  if (a.includes('review') || a.includes('apro')) return { phrase: 'aprobó la revisión de', boldTarget: true }
  if (a.includes('access') || a.includes('solicit')) return { phrase: 'solicitó acceso a', boldTarget: true }
  if (a.includes('delete') || a.includes('elimin')) return { phrase: 'eliminó', boldTarget: true }
  if (a.includes('create') || a.includes('cre')) return { phrase: 'creó', boldTarget: true }
  if (a.includes('edit') || a.includes('update') || a.includes('modific')) return { phrase: 'editó', boldTarget: true }
  if (a.includes('file')) return { phrase: 'subió el documento', boldTarget: true }
  return { phrase: 'interactuó con', boldTarget: false }
}

export function describeActivity(item: ActivityItem): {
  user: string
  actionPhrase: string
  target: string
  project: string
  time: string
  comment?: string | null
  anchorKeyword?: string
  commentId?: string | null
} {
  const userName = item.userFullName || item.userEmail || 'Usuario'
  const dict = tryDictionary(item.action)
  const target = item.resourceName || (item.resourceType ? `[${item.resourceType}]` : 'recurso')
  let projectName = '—'
  if (item.resourceType === 'project') projectName = target
  return {
    user: userName,
    actionPhrase: dict.phrase,
    target,
    project: projectName,
    time: formatRelativeTime(item.occurredAt),
    comment: (item as any).comment ?? null,
    anchorKeyword: dict.anchorKeyword ?? undefined,
    commentId: (item as any).commentId ?? null,
  }
}

export function getNavigationTarget(item: ActivityItem): string | null {
  const rt = (item.resourceType || '').toLowerCase()
  const pid = item.projectId
  if (!pid) return null
  if (rt === 'project') return `/projects/${pid}`
  const isComment = item.action && (String(item.action).endsWith('.comentado') || String(item.action).includes('comment'))
  const commentId: string | null | undefined = (item as any).commentId
  if (rt === 'file' || rt === 'folder') {
    const q = new URLSearchParams()
    if (rt === 'file') q.set('file', String(item.resourceId || ''))
    if (rt === 'folder') q.set('folder', String(item.resourceId || ''))
    if (isComment) {
      q.set('tab', 'comments')
    }
    let hash = ''
    if (isComment && commentId) {
      hash = `#comment-${String(commentId)}`
    }
    const qs = q.toString()
    return `/projects/${pid}${qs ? `?${qs}` : ''}${hash}`
  }
  return `/projects/${pid}`
}

export function phraseToParts(
  actionPhrase: string,
  anchorKeyword: string | undefined
): { text: string; isAnchor: boolean }[] {
  const kw = (anchorKeyword || '').trim()
  if (!kw) return [{ text: actionPhrase, isAnchor: false }]
  const idx = actionPhrase.toLowerCase().indexOf(kw.toLowerCase())
  if (idx < 0) return [{ text: actionPhrase, isAnchor: false }]
  const parts: { text: string; isAnchor: boolean }[] = []
  const before = actionPhrase.slice(0, idx)
  const match = actionPhrase.slice(idx, idx + kw.length)
  const after = actionPhrase.slice(idx + kw.length)
  if (before.length) parts.push({ text: before, isAnchor: false })
  parts.push({ text: match, isAnchor: true })
  if (after.length) parts.push({ text: after, isAnchor: false })
  return parts
}

