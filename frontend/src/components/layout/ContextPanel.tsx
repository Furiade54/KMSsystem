import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  X,
  FileText,
  User,
  Clock,
  Shield,
  History,
  MessageSquare,
  Folder,
  FolderKanban,
  Info,
  Link as LinkIcon,
  Download,
  ArrowUpRight,
  AlertCircle,
  Loader2,
  Send,
  MessageCircle,
  CornerDownLeft,
} from 'lucide-react'
import {
  useUIStore,
  SelectedResource,
  SelectedResourceType,
} from '@/store/uiStore'
import {
  ApiFile,
  ApiFileComment,
  ApiFileVersion,
  commentFile as apiCommentFile,
  deleteFileVersion,
  fetchFileById,
  fetchFileVersions,
  fileKind,
  formatBytes,
  listFileComments,
  setFileCurrentVersion,
  uploadFileVersion,
} from '@/services/files.service'
import { FileVersionHistoryList } from '../project/project-file-versions/FileVersionHistoryList'
import { useFileVersionForms } from '../project/project-file-versions/useFileVersionForms'
import type {
  FileVersionCallbacks,
  FileVersionMutationsPending,
} from '../project/project-file-versions/types'
import { useAuthStore } from '@/store/authStore'
import { ApiFolder, fetchFolderById } from '@/services/folders.service'
import {
  ApiProject,
  ProjectDetail,
  formatRelativeTime,
  getProjectById,
  statusBadgeInfo,
} from '@/services/projects.service'
import {
  ActivityItem,
  describeActivity,
  fetchActivity,
  getNavigationTarget,
  phraseToParts,
} from '@/services/activity.service'

type TabId = 'details' | 'activity' | 'comments'

const TABS: { id: TabId; label: string; icon: typeof Info; count?: number }[] = [
  { id: 'details', label: 'Detalles', icon: Info },
  { id: 'activity', label: 'Actividad', icon: History },
  { id: 'comments', label: 'Comentarios', icon: MessageSquare },
]

function iconForType(t: SelectedResourceType): typeof FileText {
  switch (t) {
    case 'project':
      return FolderKanban
    case 'folder':
      return Folder
    case 'file':
      return FileText
  }
}

function titleBadgeFor(t: SelectedResourceType): string {
  switch (t) {
    case 'project':
      return 'Proyecto'
    case 'folder':
      return 'Carpeta'
    case 'file':
      return 'Documento'
  }
}

function Row({
  label,
  value,
  icon: Ic,
  valueLink,
}: {
  label: string
  value: React.ReactNode
  icon?: typeof Info
  valueLink?: string
}) {
  return (
    <div className="flex items-start justify-between py-2 gap-2">
      <span className="text-muted-foreground flex items-center gap-2 text-xs shrink-0">
        {Ic ? <Ic className="w-3.5 h-3.5" /> : null}
        {label}
      </span>
      {valueLink ? (
        <a
          href={valueLink}
          target="_blank"
          rel="noreferrer"
          className="text-brand-600 dark:text-brand-300 text-xs hover:underline text-right truncate max-w-[55%]"
        >
          {value ?? '—'}
        </a>
      ) : (
        <span className="text-foreground text-xs text-right truncate max-w-[55%]">
          {value ?? '—'}
        </span>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
      {children}
    </h4>
  )
}

function PanelSkeleton() {
  return (
    <aside className="h-full w-80 flex flex-col bg-surface-primary">
      <header className="p-4 border-b border-border flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-surface-secondary animate-pulse shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-4 w-3/4 bg-surface-secondary rounded animate-pulse" />
          <div className="h-3 w-1/2 bg-surface-secondary rounded animate-pulse" />
        </div>
        <div className="w-8 h-8 rounded bg-surface-secondary animate-pulse shrink-0 -mr-2 -mt-1" />
      </header>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-5">
        <div className="border-b border-border -mx-4 px-4 pb-3 mb-3">
          <div className="h-5 w-2/3 bg-surface-secondary rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="h-3 w-28 bg-surface-secondary rounded animate-pulse" />
              <div className="h-3 w-32 bg-surface-secondary rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

function PanelError({ onClose, msg }: { onClose: () => void; msg: string }) {
  return (
    <aside className="h-full w-80 flex flex-col bg-surface-primary">
      <header className="p-4 border-b border-border flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center shrink-0 text-rose-500 dark:text-rose-300">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">Error al cargar</h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">No se pudo obtener el recurso</p>
        </div>
        <button onClick={onClose} className="btn-ghost -mr-2 -mt-1">
          <X className="w-4 h-4" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
        <div className="p-3 rounded-lg bg-surface-secondary border border-border text-destructive/90 text-xs">
          {msg || 'Error desconocido'}
        </div>
      </div>
    </aside>
  )
}

export default function ContextPanel() {
  const { selectedResource, setSelectedResource, dismissRightPanel } = useUIStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sp, setSp] = useSearchParams()
  const [tab, setTabInternal] = useState<TabId>('details')
  const commentAnchorId = location.hash && location.hash.startsWith('#comment-')
    ? location.hash.slice('#comment-'.length)
    : null
  const setTab: (t: TabId, opts?: { writeToUrl?: boolean }) => void = (t, opts) => {
    setTabInternal(t)
    if (opts?.writeToUrl !== false && sp.get('tab') !== t) {
      const next = new URLSearchParams(sp)
      next.set('tab', t)
      setSp(next, { replace: true })
    }
  }
  useEffect(() => {
    const allowed: TabId[] = ['details', 'activity', 'comments']
    const tabParam = sp.get('tab')
    const fromUrl = allowed.includes(tabParam as TabId) ? (tabParam as TabId) : null
    const winner: TabId = fromUrl ?? 'details'
    setTabInternal(winner)
  }, [sp, selectedResource?.id, selectedResource?.type])
  const highlightTimerRef = useRef<number | null>(null)
  useEffect(() => {
    if (!commentAnchorId) return
    if (tab !== 'comments') return
    const id = commentAnchorId
    const tryFind = (attempt = 0) => {
      try {
        const el = document.getElementById(`comment-${id}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.classList.add('ring-2', 'ring-brand-500/60', 'bg-brand-500/10')
          if (highlightTimerRef.current != null) window.clearTimeout(highlightTimerRef.current)
          highlightTimerRef.current = window.setTimeout(() => {
            try {
              el.classList.remove('ring-2', 'ring-brand-500/60', 'bg-brand-500/10')
            } catch {}
            highlightTimerRef.current = null
          }, 3500)
          return
        }
      } catch {}
      if (attempt < 8) {
        window.setTimeout(() => tryFind(attempt + 1), 120)
      }
    }
    tryFind()
    return () => {
      if (highlightTimerRef.current != null) {
        window.clearTimeout(highlightTimerRef.current)
        highlightTimerRef.current = null
      }
    }
  }, [commentAnchorId, tab])

  const handleClose = () => {
    setSelectedResource(null)
    dismissRightPanel()
    if (sp.get('tab') || sp.get('file') || sp.get('folder')) {
      const next = new URLSearchParams(sp)
      next.delete('tab')
      next.delete('file')
      next.delete('folder')
      setSp(next, { replace: true })
    }
  }

  if (!selectedResource) {
    return (
      <div className="h-full w-80 p-6 flex flex-col items-center justify-center text-center text-muted-foreground">
        <FileText className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm font-medium">Sin recurso seleccionado</p>
        <p className="text-xs mt-1">
          Selecciona un documento, carpeta o proyecto para ver su contexto.
        </p>
      </div>
    )
  }

  if (selectedResource.type === 'file') {
    return (
      <FilePanel
        resource={selectedResource as SelectedResource & { type: 'file' }}
        tab={tab}
        onTab={setTab}
        onClose={handleClose}
        onOpenProject={() => navigate(`/projects/${selectedResource.projectId}`)}
      />
    )
  }
  if (selectedResource.type === 'folder') {
    return (
      <FolderPanel
        resource={selectedResource as SelectedResource & { type: 'folder' }}
        tab={tab}
        onTab={setTab}
        onClose={handleClose}
        onOpenProject={() => navigate(`/projects/${selectedResource.projectId}`)}
      />
    )
  }
  return (
    <ProjectPanel
      resource={selectedResource as SelectedResource & { type: 'project' }}
      tab={tab}
      onTab={setTab}
      onClose={handleClose}
      onOpenProject={() => navigate(`/projects/${selectedResource.projectId}`)}
    />
  )
}

function PanelHeader({
  title,
  subtitle,
  t,
  onClose,
  primaryAction,
  onOpenProject,
}: {
  title: string
  subtitle?: string
  t: SelectedResourceType
  onClose: () => void
  primaryAction?: React.ReactNode
  onOpenProject?: () => void
}) {
  const Icon = iconForType(t)
  return (
    <header className="p-4 border-b border-border flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-brand-600/20 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-brand-500 dark:text-brand-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-secondary text-foreground font-medium">
            {titleBadgeFor(t)}
          </span>
          {onOpenProject ? (
            <button
              onClick={onOpenProject}
              className="text-[10px] px-1.5 py-0.5 rounded text-brand-600 dark:text-brand-300 hover:bg-brand-500/10 flex items-center gap-1"
            >
              <ArrowUpRight className="w-3 h-3" /> Abrir
            </button>
          ) : null}
        </div>
        <h3 className="font-semibold text-foreground truncate mt-1" title={title}>
          {title}
        </h3>
        {subtitle ? (
          <p className="text-xs text-muted-foreground mt-0.5 truncate" title={subtitle}>
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        {primaryAction}
        <button onClick={onClose} className="btn-ghost -mr-2 -mt-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}

function TabsBar({
  active,
  onChange,
  counts,
}: {
  active: TabId
  onChange: (t: TabId) => void
  counts?: Partial<Record<TabId, number>>
}) {
  return (
    <div className="flex border-b border-border -mx-4 px-4 gap-4">
      {TABS.map((t) => {
        const n = counts?.[t.id]
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={clsx(
              'py-2 text-xs font-medium border-b-2 -mb-px flex items-center gap-1.5',
              active === t.id
                ? 'border-brand-500 text-brand-600 dark:text-brand-300'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {typeof n === 'number' && n > 0 ? (
              <span
                className={clsx(
                  'min-w-[18px] h-[18px] px-1 rounded-full inline-flex items-center justify-center text-[9px] font-semibold',
                  active === t.id
                    ? 'bg-brand-500/20 text-brand-600 dark:text-brand-200'
                    : 'bg-surface-tertiary text-muted-foreground',
                )}
              >
                {n > 99 ? '99+' : String(n)}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

type CommentThread = ApiFileComment & {
  replies: CommentThread[]
}

function buildThread(items: ApiFileComment[]): CommentThread[] {
  const byId = new Map<string, CommentThread>()
  for (const c of items) byId.set(c.id, { ...c, replies: [] })
  const roots: CommentThread[] = []
  for (const c of items) {
    const full = byId.get(c.id)!
    if (c.parentId && byId.has(c.parentId)) {
      byId.get(c.parentId)!.replies.push(full)
    } else {
      roots.push(full)
    }
  }
  return roots
}

function CommentCard({
  c,
  depth,
  fileId,
  projectId,
  onMutate,
}: {
  c: CommentThread
  depth: number
  fileId: string
  projectId: string
  onMutate: (payload: { id: string; content: string; parentId?: string | null }) => Promise<unknown> | unknown
}) {
  const queryClient = useQueryClient()
  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyError, setReplyError] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)
  const replyRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (replying && replyRef.current) {
      try { replyRef.current.focus() } catch {}
    }
  }, [replying])
  const authorName = c.userFullName || c.userEmail || 'este comentario'
  const ui = {
    btnLabel: 'Responder',
    btnLabelCancel: depth === 0 ? 'Cancelar respuesta' : 'Cancelar respuesta',
    submitLabel: 'Responder',
    placeholder:
      depth === 0
        ? `Responde a ${authorName}…`
        : `Responde a la réplica de ${authorName}…`,
    allowReply: depth < 2,
  }
  const submitReply = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault()
    if (replyLoading) return
    const trimmed = replyText.trim()
    if (trimmed.length === 0 || trimmed.length > 2000) {
      setReplyError('La respuesta debe tener entre 1 y 2000 caracteres')
      return
    }
    setReplyError('')
    setReplyLoading(true)
    try {
      await onMutate({ id: fileId, content: trimmed, parentId: c.id })
      await queryClient.invalidateQueries({ queryKey: ['file', 'comments', fileId] })
      await queryClient.invalidateQueries({ queryKey: ['activity'] })
      await queryClient.invalidateQueries({ queryKey: ['project', 'files', projectId] })
      setReplyText('')
      setReplyError('')
      setReplying(false)
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setReplyLoading(false)
    }
  }
  return (
    <div className="space-y-3">
      <div
        id={`comment-${c.id}`}
        className={clsx(
          'p-3 rounded-lg bg-surface-secondary border border-border transition-[outline,background-color] duration-500 outline outline-0 outline-transparent',
          depth === 1 && 'ml-6 border-l-[3px] border-l-brand-500/40',
          depth >= 2 && 'ml-12 border-l-[3px] border-l-brand-500/25'
        )}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-600 dark:text-brand-300 flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
            {initials2(c.userFullName || null, c.userEmail || null)}
          </div>
          <span className="text-[11px] font-medium text-foreground truncate">
            {c.userFullName || c.userEmail || 'Usuario'}
          </span>
          {depth === 0 && (
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 bg-surface-tertiary/60 border border-border rounded px-1.5 py-0.5">
              Comentario
            </span>
          )}
          {depth === 1 && (
            <span className="text-[9px] uppercase tracking-wider text-brand-600/80 bg-brand-500/10 border border-brand-500/30 rounded px-1.5 py-0.5">
              Réplica
            </span>
          )}
          {depth >= 2 && (
            <span className="text-[9px] uppercase tracking-wider text-success-600/80 bg-success-500/10 border border-success-500/30 rounded px-1.5 py-0.5">
              Contra-réplica
            </span>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground whitespace-nowrap">
            {formatRelativeTime(c.createdAt)}
          </span>
        </div>
        <p className="text-[11px] text-foreground/90 leading-relaxed whitespace-pre-wrap break-words pl-8">
          {c.content}
        </p>
        {ui.allowReply ? (
          <div className="flex items-center justify-end mt-2 pl-8">
            <button
              type="button"
              onClick={() => setReplying((r) => !r)}
              className={clsx(
                'text-[10px] flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-tertiary transition-colors',
                replying
                  ? 'text-brand-600 dark:text-brand-300'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <CornerDownLeft className="w-3 h-3" />
              {replying ? ui.btnLabelCancel : ui.btnLabel}
            </button>
          </div>
        ) : null}
        {replying && ui.allowReply ? (
          <form onSubmit={submitReply} className="mt-3 space-y-2">
            {replyError ? (
              <div className="text-[10px] rounded-md p-2 bg-status-blocked/15 border border-status-blocked/40 text-destructive/90">
                {replyError}
              </div>
            ) : null}
            <textarea
              ref={replyRef}
              rows={2}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              maxLength={2000}
              placeholder={ui.placeholder}
              className="input-base w-full resize-y min-h-[56px] text-xs"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {replyText.length}
                <span className="text-muted-foreground/60"> / 2000</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-ghost text-[10px] px-2 py-1"
                  onClick={() => {
                    setReplying(false)
                    setReplyText('')
                    setReplyError('')
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary gap-1.5 text-[10px] px-2.5 py-1"
                  disabled={replyLoading}
                >
                  {replyLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    <>
                      <Send className="w-3 h-3" />
                      {ui.submitLabel}
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        ) : null}
      </div>
      {c.replies.length ? (
        <div className="space-y-3">
          {c.replies.map((r) => (
            <CommentCard
              key={r.id}
              c={r}
              depth={depth + 1}
              fileId={fileId}
              projectId={projectId}
              onMutate={onMutate}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function CommentsFeed({
  loading,
  error,
  items,
  fileId,
  projectId,
  onReply,
}: {
  loading: boolean
  error: string | null
  items: ApiFileComment[]
  fileId: string
  projectId: string
  onReply: (payload: { id: string; content: string; parentId?: string | null }) => Promise<unknown> | unknown
}) {
  const roots = useMemo(() => buildThread(items), [items])
  if (loading && !items.length)
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="p-3 rounded-lg bg-surface-secondary border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-surface-tertiary animate-pulse shrink-0" />
              <div className="h-3 w-28 bg-surface-tertiary rounded animate-pulse" />
              <div className="ml-auto h-2 w-10 bg-surface-tertiary rounded animate-pulse" />
            </div>
            <div className="h-3 w-full bg-surface-tertiary rounded animate-pulse ml-8 mb-1" />
            <div className="h-3 w-4/5 bg-surface-tertiary rounded animate-pulse ml-8" />
          </div>
        ))}
      </div>
    )
  if (error)
    return (
      <div className="p-3 rounded-lg bg-status-blocked/10 border border-status-blocked/40 text-[11px] text-destructive/90">
        {error}
      </div>
    )
  if (!items.length)
    return (
      <div className="p-5 rounded-lg bg-surface-secondary border border-border text-center text-xs text-muted-foreground space-y-2">
        <MessageCircle className="w-7 h-7 mx-auto opacity-40 text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">Aún no hay comentarios</p>
          <p className="mt-0.5">Sé la primera persona en comentar este documento.</p>
        </div>
      </div>
    )
  return (
    <div className="space-y-3">
      {roots.map((r) => (
        <CommentCard
          key={r.id}
          c={r}
          depth={0}
          fileId={fileId}
          projectId={projectId}
          onMutate={onReply}
        />
      ))}
    </div>
  )
}

function FilePanel({
  resource,
  tab,
  onTab,
  onClose,
  onOpenProject,
}: {
  resource: SelectedResource & { type: 'file' }
  tab: TabId
  onTab: (t: TabId) => void
  onClose: () => void
  onOpenProject: () => void
}) {
  const queryClient = useQueryClient()
  const q = useQuery({
    queryKey: ['file', 'detail', resource.id],
    queryFn: () => fetchFileById(resource.id),
    staleTime: 60_000,
    retry: 1,
  })
  const actQ = useQuery({
    queryKey: ['activity', { limit: 12, projectId: resource.projectId }],
    queryFn: () => fetchActivity({ limit: 12, pageSize: 12 }),
    staleTime: 30_000,
  })
  const commentsQ = useQuery({
    queryKey: ['file', 'comments', resource.id],
    queryFn: () => listFileComments(resource.id),
    staleTime: 30_000,
  })
  const [newComment, setNewComment] = useState('')
  const [newCommentError, setNewCommentError] = useState('')
  const newCommentRef = useRef<HTMLTextAreaElement>(null)
  const commentInlineMutation = useMutation({
    mutationFn: (payload: { id: string; content: string; parentId?: string | null }) =>
      apiCommentFile(payload.id, payload.content, { parentId: payload.parentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file', 'comments', resource.id] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
      queryClient.invalidateQueries({ queryKey: ['project', 'files', resource.projectId] })
      setNewComment('')
      setNewCommentError('')
    },
    onError: (err: unknown) =>
      setNewCommentError(err instanceof Error ? err.message : 'Error desconocido'),
  })

  const authUser = useAuthStore((s) => s.user)

  const fileVersionsQuery = useQuery({
    queryKey: ['file', 'versions', resource.id],
    queryFn: () => fetchFileVersions(resource.id),
    staleTime: 45_000,
    retry: 1,
  })

  const fileVersionsForms = useFileVersionForms()

  const uploadVersionMutation = useMutation({
    mutationFn: (payload: { file: File; comment: string | null }) =>
      uploadFileVersion({
        fileId: resource.id,
        file: payload.file,
        comment: payload.comment ?? undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file', 'versions', resource.id] })
      queryClient.invalidateQueries({ queryKey: ['file', 'detail', resource.id] })
      queryClient.invalidateQueries({ queryKey: ['project', 'files', resource.projectId] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
      fileVersionsForms.setUploadFile(null)
      fileVersionsForms.setUploadComment('')
      fileVersionsForms.toggleShowUpload()
      fileVersionsForms.setUploadError(null)
    },
    onError: (err: unknown) =>
      fileVersionsForms.setUploadError(err instanceof Error ? err.message : 'Error desconocido'),
  })

  const setCurrentVersionMutation = useMutation({
    mutationFn: (versionId: string) => setFileCurrentVersion(resource.id, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file', 'detail', resource.id] })
      queryClient.invalidateQueries({ queryKey: ['file', 'versions', resource.id] })
      queryClient.invalidateQueries({ queryKey: ['project', 'files', resource.projectId] })
    },
  })

  const deleteVersionMutation = useMutation({
    mutationFn: (versionId: string) => deleteFileVersion(resource.id, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file', 'detail', resource.id] })
      queryClient.invalidateQueries({ queryKey: ['file', 'versions', resource.id] })
      queryClient.invalidateQueries({ queryKey: ['project', 'files', resource.projectId] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })

  useEffect(() => {
    if (tab !== 'comments') return
    const t = setTimeout(() => {
      if (newCommentRef.current) {
        try { newCommentRef.current.focus() } catch {}
      }
    }, 30)
    return () => clearTimeout(t)
  }, [tab])

  if (q.isLoading && !q.data) return <PanelSkeleton />
  if (q.isError)
    return <PanelError msg={(q.error as Error).message || 'Error al cargar el archivo'} onClose={onClose} />

  const f: ApiFile = q.data!
  const kind = fileKind(f)
  const subtitle = `${kind.toUpperCase()} · ${formatBytes(f.sizeBytes)}${
    f.storageProvider === 's3' ? ' · S3' : f.storageProvider === 'local' ? ' · Local' : ''
  }`

  const submitQuickComment = (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault()
    if (commentInlineMutation.isPending) return
    const trimmed = newComment.trim()
    if (trimmed.length === 0 || trimmed.length > 2000) {
      setNewCommentError('El comentario debe tener entre 1 y 2000 caracteres')
      return
    }
    setNewCommentError('')
    commentInlineMutation.mutate({ id: resource.id, content: trimmed })
  }
  const commentCount = commentsQ.data?.length ?? 0

  return (
    <aside className="h-full w-80 flex flex-col bg-surface-primary">
      <PanelHeader
        t={resource.type}
        title={f.name}
        subtitle={subtitle}
        onClose={onClose}
        onOpenProject={onOpenProject}
        primaryAction={f.downloadUrl ? (
              <a
                href={f.downloadUrl}
                target="_blank"
                rel="noreferrer"
                title="Descargar"
                className="btn-icon bg-brand-500/20 text-brand-600 dark:text-brand-300 hover:bg-brand-500/30"
              >
              <Download className="w-4 h-4" />
            </a>
          ) : null
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-5">
        <TabsBar active={tab} onChange={onTab} counts={{ comments: commentCount || undefined }} />
        {tab === 'details' && (
          <>
            <section>
              <SectionTitle>Propietario</SectionTitle>
              <Row
                icon={User}
                label="Creado por"
                value={f.ownerName || f.ownerEmail || '—'}
              />
            </section>
            <section>
              <SectionTitle>Metadatos</SectionTitle>
              <Row
                icon={FolderKanban}
                label="Proyecto"
                value="Ver proyecto"
                valueLink={`/projects/${resource.projectId}`}
              />
              <Row
                icon={Clock}
                label="Creado"
                value={formatRelativeTime(f.createdAt)}
              />
              <Row
                icon={History}
                label="Actualizado"
                value={f.updatedAt ? formatRelativeTime(f.updatedAt) : '—'}
              />
              <Row
                icon={Shield}
                label="Tamaño"
                value={formatBytes(f.sizeBytes)}
              />
              <Row icon={LinkIcon} label="Tipo MIME" value={f.mimeType || '—'} />
              <Row icon={FileText} label="Extensión" value={f.extension || '—'} />
              <Row
                icon={Folder}
                label="Carpeta"
                value={f.folderId ? 'En carpeta' : 'Raíz del proyecto'}
              />
            </section>
            {f.s3VersionId || f.s3ETag || f.checksumSHA256 ? (
              <section>
                <SectionTitle>Almacenamiento</SectionTitle>
                <Row label="Provider" value={f.storageProvider.toUpperCase()} />
                <Row label="Bucket" value={f.s3Bucket || '—'} />
                <Row label="Versión S3" value={f.s3VersionId || '—'} />
                <Row label="ETag" value={f.s3ETag || '—'} />
                <Row
                  label="SHA256"
                  value={
                    f.checksumSHA256 ? (
                      <span className="font-mono text-[10px] break-all">
                        {f.checksumSHA256.slice(0, 20)}…
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />
              </section>
            ) : null}

            <section className="border-t border-border pt-3 mt-3">
              <SectionTitle>
                📜 Versiones ({f.versionCount ?? fileVersionsQuery.data?.length ?? 0})
              </SectionTitle>
              {(f.currentVersionNumber != null || (fileVersionsQuery.data && fileVersionsQuery.data.length > 0)) && (
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    V{String(f.currentVersionNumber ?? '—')}
                  </span>
                  <span>Versión actual activa · usada por actas, doc. maestro y comentarios</span>
                </div>
              )}
              {(() => {
                const canEdit = !!authUser
                const authIdLower = authUser?.id ? String(authUser.id).toLowerCase() : null
                const ownerIdLower = f.ownerId ? String(f.ownerId).toLowerCase() : null
                const canManage = !!authUser && (!!authUser.isOrgAdmin || (authIdLower != null && authIdLower === ownerIdLower))

                const pending: FileVersionMutationsPending = {
                  uploadVersion: uploadVersionMutation.isPending,
                  setCurrentVersion: setCurrentVersionMutation.isPending,
                  deleteVersion: deleteVersionMutation.isPending,
                }
                const callbacks: FileVersionCallbacks = {
                  canEdit,
                  canManage,
                  onSetCurrent: async (versionId: string) => {
                    await setCurrentVersionMutation.mutateAsync(versionId)
                  },
                  onDelete: async (versionId: string) => {
                    await deleteVersionMutation.mutateAsync(versionId)
                  },
                  onDownload: (_version: ApiFileVersion) => {
                  },
                  onUploadNew: async (file: File, comment: string | null) => {
                    await uploadVersionMutation.mutateAsync({ file, comment })
                  },
                }
                return (
                  <FileVersionHistoryList
                    items={fileVersionsQuery.data ?? []}
                    currentVersionId={f.currentVersionId}
                    pending={pending}
                    callbacks={callbacks}
                    uiState={fileVersionsForms}
                    formatBytes={formatBytes}
                  />
                )
              })()}
              {fileVersionsQuery.isLoading && !fileVersionsQuery.data && (
                <div className="text-xs text-muted-foreground italic py-2">Cargando versiones…</div>
              )}
              {fileVersionsQuery.isError && (
                <div className="text-[11px] rounded-md p-2 bg-status-blocked/15 border border-status-blocked/40 text-destructive/90 mt-2">
                  {fileVersionsQuery.error instanceof Error
                    ? fileVersionsQuery.error.message
                    : 'Error al cargar las versiones'}
                </div>
              )}
            </section>
          </>
        )}
        {tab === 'activity' && (
          <ActivityList
            loading={actQ.isLoading && !actQ.data}
            items={actQ.data?.items ?? []}
            resourceFilter={{ type: resource.type, id: resource.id, projectId: resource.projectId }}
          />
        )}
        {tab === 'comments' && (
          <div className="space-y-4">
            <form onSubmit={submitQuickComment} className="space-y-2">
              <label className="block text-[11px] text-muted-foreground font-medium">
                Publica un comentario
              </label>
              {newCommentError || commentInlineMutation.error ? (
                <div className="text-[11px] rounded-md p-2 bg-status-blocked/15 border border-status-blocked/40 text-destructive/90">
                  {newCommentError ||
                    (commentInlineMutation.error instanceof Error
                      ? commentInlineMutation.error.message
                      : 'Error desconocido')}
                </div>
              ) : null}
              <textarea
                ref={newCommentRef}
                rows={3}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                maxLength={2000}
                placeholder="Escribe una nota sobre este documento, una sugerencia o corrección para el equipo…"
                className="input-base w-full resize-y min-h-[72px] text-xs"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {newComment.length}
                  <span className="text-muted-foreground/60"> / 2000</span>
                </span>
                <button
                  type="submit"
                  className="btn-primary gap-1.5 text-[11px] px-2.5 py-1.5"
                  onClick={submitQuickComment}
                  disabled={commentInlineMutation.isPending}
                >
                  {commentInlineMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Publicando…
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Publicar
                    </>
                  )}
                </button>
              </div>
            </form>
            <CommentsFeed
              loading={commentsQ.isLoading && !commentsQ.data}
              error={commentsQ.isError ? (commentsQ.error as Error).message || 'Error al cargar comentarios' : null}
              items={commentsQ.data ?? []}
              fileId={resource.id}
              projectId={resource.projectId}
              onReply={async (payload) => commentInlineMutation.mutateAsync(payload)}
            />
          </div>
        )}
      </div>
      <footer className="p-3 border-t border-border space-y-2">
        {f.downloadUrl ? (
          <a
            href={f.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-primary w-full text-xs no-underline"
          >
            <Download className="w-3.5 h-3.5" /> Descargar archivo
          </a>
        ) : null}
        <button onClick={onOpenProject} className="btn-secondary w-full text-xs">
          <FolderKanban className="w-3.5 h-3.5" /> Abrir proyecto
        </button>
      </footer>
    </aside>
  )
}

function FolderPanel({
  resource,
  tab,
  onTab,
  onClose,
  onOpenProject,
}: {
  resource: SelectedResource & { type: 'folder' }
  tab: TabId
  onTab: (t: TabId) => void
  onClose: () => void
  onOpenProject: () => void
}) {
  const q = useQuery({
    queryKey: ['folder', 'detail', resource.id],
    queryFn: () => fetchFolderById(resource.id),
    staleTime: 60_000,
    retry: 1,
  })
  const actQ = useQuery({
    queryKey: ['activity', { limit: 6, projectId: resource.projectId }],
    queryFn: () => fetchActivity({ limit: 6 }),
    staleTime: 30_000,
  })

  if (q.isLoading && !q.data) return <PanelSkeleton />
  if (q.isError)
    return <PanelError msg={(q.error as Error).message || 'Error al cargar la carpeta'} onClose={onClose} />

  const f: ApiFolder = q.data!
  const subtitle = `${f.filesCount} archivos · ${f.childrenCount} subcarpetas`

  return (
    <aside className="h-full w-80 flex flex-col bg-surface-primary">
      <PanelHeader
        t={resource.type}
        title={f.name}
        subtitle={subtitle}
        onClose={onClose}
        onOpenProject={onOpenProject}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-5">
        <TabsBar active={tab} onChange={onTab} />
        {tab === 'details' && (
          <>
            <section>
              <SectionTitle>General</SectionTitle>
              <Row
                icon={FolderKanban}
                label="Proyecto"
                value="Ver proyecto"
                valueLink={`/projects/${resource.projectId}`}
              />
              <Row
                icon={Folder}
                label="Carpeta padre"
                value={f.parentId ? 'Contenida' : 'Raíz del proyecto'}
              />
              <Row icon={FileText} label="Archivos" value={`${f.filesCount}`} />
              <Row icon={Folder} label="Subcarpetas" value={`${f.childrenCount}`} />
              <Row
                icon={Shield}
                label="Permisos"
                value={f.inheritPermissions ? 'Heredados' : 'Explícitos'}
              />
            </section>
            <section>
              <SectionTitle>Trazabilidad</SectionTitle>
              <Row
                icon={Clock}
                label="Creada"
                value={formatRelativeTime(f.createdAt)}
              />
              <Row
                icon={History}
                label="Actualizada"
                value={f.updatedAt ? formatRelativeTime(f.updatedAt) : '—'}
              />
              <Row
                icon={User}
                label="Propietario ID"
                value={f.ownerId ? f.ownerId.slice(0, 13) + '…' : 'Sin asignar'}
              />
            </section>
          </>
        )}
        {tab === 'activity' && (
          <ActivityList
            loading={actQ.isLoading && !actQ.data}
            items={actQ.data?.items ?? []}
            resourceFilter={{ type: resource.type, id: resource.id, projectId: resource.projectId }}
          />
        )}
        {tab === 'comments' && (
          <div className="p-4 rounded-lg bg-surface-secondary border border-border text-center text-xs text-muted-foreground">
            Comentarios por carpeta disponibles próximamente.
          </div>
        )}
      </div>
      <footer className="p-3 border-t border-border">
        <button onClick={onOpenProject} className="btn-secondary w-full text-xs">
          <FolderKanban className="w-3.5 h-3.5" /> Abrir proyecto
        </button>
      </footer>
    </aside>
  )
}

function ProjectPanel({
  resource,
  tab,
  onTab,
  onClose,
  onOpenProject,
}: {
  resource: SelectedResource & { type: 'project' }
  tab: TabId
  onTab: (t: TabId) => void
  onClose: () => void
  onOpenProject: () => void
}) {
  const q = useQuery({
    queryKey: ['project', 'detail', resource.id],
    queryFn: () => getProjectById(resource.id),
    staleTime: 60_000,
    retry: 1,
  })
  const actQ = useQuery({
    queryKey: ['activity', { limit: 6, projectId: resource.projectId }],
    queryFn: () => fetchActivity({ limit: 6 }),
    staleTime: 30_000,
  })

  if (q.isLoading && !q.data) return <PanelSkeleton />
  if (q.isError)
    return <PanelError msg={(q.error as Error).message || 'Error al cargar el proyecto'} onClose={onClose} />

  const pd: ProjectDetail = q.data!
  const p: ApiProject = pd.project
  const statusInfo = statusBadgeInfo(p.status)

  return (
    <aside className="h-full w-80 flex flex-col bg-surface-primary">
      <PanelHeader
        t={resource.type}
        title={p.name}
        subtitle={`${statusInfo.label}`}
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-5">
        <TabsBar active={tab} onChange={onTab} />
        {tab === 'details' && (
          <>
            <section>
              <SectionTitle>Estado</SectionTitle>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Shield className="w-3.5 h-3.5" /> Estado
                </span>
                <span
                  className={clsx(
                    'text-[11px] px-2 py-0.5 rounded font-medium',
                    statusInfo.bgClass,
                    statusInfo.textClass,
                  )}
                >
                  {statusInfo.label}
                </span>
              </div>
              <Row
                icon={FolderKanban}
                label="Progreso"
                value={`${Math.round(p.progress ?? 0)}%`}
              />
            </section>
            <section>
              <SectionTitle>Descripción</SectionTitle>
              <p className="text-xs text-muted-foreground dark:text-slate-300 whitespace-pre-wrap line-clamp-5">
                {p.description || 'Sin descripción'}
              </p>
            </section>
            <section>
              <SectionTitle>Trazabilidad</SectionTitle>
              <Row
                icon={Clock}
                label="Creado"
                value={formatRelativeTime(p.createdAt)}
              />
              <Row
                icon={History}
                label="Actualizado"
                value={p.updatedAt ? formatRelativeTime(p.updatedAt) : '—'}
              />
              <Row
                icon={User}
                label="Propietario ID"
                value={p.ownerId ? p.ownerId.slice(0, 13) + '…' : 'Sin asignar'}
              />
            </section>
            {'membersCount' in p || 'filesCount' in p ? (
              <section>
                <SectionTitle>Contenido</SectionTitle>
                <Row label="Miembros" value={`${(p as any).membersCount ?? '—'}`} />
                <Row label="Carpetas" value={`${(p as any).foldersCount ?? '—'}`} />
                <Row label="Archivos" value={`${(p as any).filesCount ?? '—'}`} />
              </section>
            ) : null}
          </>
        )}
        {tab === 'activity' && (
          <ActivityList
            loading={actQ.isLoading && !actQ.data}
            items={actQ.data?.items ?? []}
            resourceFilter={{ type: resource.type, id: resource.id, projectId: resource.projectId }}
          />
        )}
        {tab === 'comments' && (
          <div className="p-4 rounded-lg bg-surface-secondary border border-border text-center text-xs text-muted-foreground">
            Comentarios por proyecto disponibles próximamente.
          </div>
        )}
      </div>
      <footer className="p-3 border-t border-border">
        <button onClick={onOpenProject} className="btn-primary w-full text-xs">
          <ArrowUpRight className="w-3.5 h-3.5" /> Abrir proyecto completo
        </button>
      </footer>
    </aside>
  )
}

function initials2(full: string | null, email: string | null, fallback = '??'): string {
  const base = full || email || fallback
  return base
    .split(/[.\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || fallback.slice(0, 2).toUpperCase()
}

function ActivityList({
  loading,
  items,
  resourceFilter,
}: {
  loading: boolean
  items: ActivityItem[]
  resourceFilter?: { type: SelectedResourceType; id: string; projectId: string } | null
}) {
  function isAboutResource(a: ActivityItem): boolean {
    if (!resourceFilter) return true
    const sameRes = a.resourceId === resourceFilter.id && a.resourceType === resourceFilter.type
    const sameProject = a.projectId === resourceFilter.projectId
    return resourceFilter.type === 'project' ? sameProject : sameRes || (a.resourceType === resourceFilter.type && sameProject)
  }
  const ordered = resourceFilter
    ? [
        ...items.filter(isAboutResource),
        ...items.filter((a) => !isAboutResource(a) && a.projectId === resourceFilter.projectId),
        ...items.filter((a) => a.projectId !== resourceFilter.projectId),
      ].slice(0, 6)
    : items.slice(0, 6)
  if (loading)
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-3 rounded-lg bg-surface-secondary border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-surface-tertiary animate-pulse" />
              <div className="h-3 w-32 bg-surface-tertiary rounded animate-pulse" />
              <div className="ml-auto h-3 w-10 bg-surface-tertiary rounded animate-pulse" />
            </div>
            <div className="h-3 w-4/5 bg-surface-tertiary rounded animate-pulse ml-7" />
          </div>
        ))}
      </div>
    )
  if (!ordered.length)
    return (
      <div className="p-5 rounded-lg bg-surface-secondary border border-border text-center text-xs text-muted-foreground">
        No hay actividad reciente que mostrar.
      </div>
    )
  return (
    <div className="space-y-3">
      {ordered.map((a) => {
        const d = describeActivity(a)
        const targetHref = getNavigationTarget(a)
        const isComment = a.action.toLowerCase().includes('comment') || a.action === 'file.comentado'
        const hasAnchorLink = isComment && !!targetHref && !!d.commentId
        const phraseParts = phraseToParts(d.actionPhrase, d.anchorKeyword)
        return (
          <div
            key={a.id}
            className="p-3 rounded-lg bg-surface-secondary border border-border"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-600 dark:text-brand-300 flex items-center justify-center text-[9px] font-bold uppercase">
                {initials2(a.userFullName, a.userEmail)}
              </div>
              <span className="text-[11px] font-medium text-foreground truncate">
                {a.userFullName || a.userEmail || 'Usuario'}
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground whitespace-nowrap">
                {formatRelativeTime(a.occurredAt)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground dark:text-slate-300 pl-7 leading-snug">
              {phraseParts.map((seg, i) => {
                if (!seg.isAnchor) {
                  return (
                    <span key={`pcp-${i}`}>
                      {seg.text}
                      {i < phraseParts.length - 1 ? ' ' : ''}
                    </span>
                  )
                }
                if (hasAnchorLink) {
                  return (
                    <Link
                      key={`pca-${i}`}
                      to={targetHref}
                      className="inline font-semibold text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-200 hover:underline underline-offset-2"
                      title="Abrir comentario"
                    >
                      {seg.text}
                    </Link>
                  )
                }
                return <span key={`pcp-${i}`} className="font-semibold">{seg.text}</span>
              })}{' '}
              {targetHref ? (
                <Link
                  to={targetHref}
                  className="font-medium text-brand-600 dark:text-brand-300 hover:underline underline-offset-2"
                  title="Abrir documento"
                >
                  {d.target}
                </Link>
              ) : (
                <span className="font-medium text-brand-600 dark:text-brand-300">
                  {d.target}
                </span>
              )}
            </p>
            {isComment && d.comment ? (
              <div className="pl-7 mt-1.5">
                <blockquote className="border-l-[2px] border-brand-500/50 pl-2 py-0.5 rounded-r-sm bg-brand-500/5 dark:bg-brand-500/10">
                  <p className="text-[11px] text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
                    <span className="text-foreground/50 select-none">“</span>
                    {d.comment}
                    <span className="text-foreground/50 select-none">”</span>
                  </p>
                </blockquote>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
