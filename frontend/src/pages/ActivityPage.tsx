import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, History } from 'lucide-react'
import {
  ActivityItem,
  ActivityResponse,
  describeActivity,
  fetchActivity,
  getNavigationTarget,
  phraseToParts,
} from '../services/activity.service'

function initials(fullName: string | null | undefined, email: string | null | undefined): string {
  const raw = (fullName || email || '??').trim()
  if (!raw) return '??'
  if (!fullName) {
    const local = email?.split('@')[0] || ''
    return local ? local.slice(0, 2).toUpperCase() : '??'
  }
  const parts = fullName.split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '??'
}

function ActivityRowSkeleton() {
  return (
    <div className="p-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-surface-secondary animate-pulse shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 w-3/4 bg-surface-secondary rounded animate-pulse" />
        <div className="h-3 w-1/3 bg-surface-secondary rounded animate-pulse" />
      </div>
    </div>
  )
}

function ActivityRow({ a }: { a: ActivityItem }) {
  const d = describeActivity(a)
  const targetHref = getNavigationTarget(a)
  const projectHref = a.projectId ? `/projects/${a.projectId}` : null
  const isCommentAction = a.action.toLowerCase().includes('comment') || a.action === 'file.comentado'
  const hasAnchorLink = isCommentAction && !!targetHref && !!d.commentId
  const phraseParts = phraseToParts(d.actionPhrase, d.anchorKeyword)
  return (
    <div className="p-4 flex items-start gap-3 hover:bg-surface-secondary/50 transition-colors">
      <div className="w-8 h-8 rounded-full bg-surface-tertiary flex items-center justify-center text-[11px] font-bold shrink-0">
        {initials(a.userFullName, a.userEmail)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground dark:text-slate-300">
          <span className="font-medium text-foreground">{d.user}</span>{' '}
          {phraseParts.map((seg, i) => {
            if (!seg.isAnchor) {
              return (
                <span key={`p-${i}`}>
                  {seg.text}
                  {i < phraseParts.length - 1 ? ' ' : ''}
                </span>
              )
            }
            if (hasAnchorLink) {
              return (
                <Link
                  key={`an-${i}`}
                  to={targetHref}
                  className="inline font-semibold text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-200 hover:underline underline-offset-2"
                  title="Abrir comentario"
                >
                  {seg.text}
                </Link>
              )
            }
            return <span key={`p-${i}`} className="font-semibold">{seg.text}</span>
          })}{' '}
          {targetHref ? (
            <Link
              to={targetHref}
              className="font-medium text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-200 hover:underline underline-offset-2 break-words"
              title="Abrir documento"
            >
              {d.target}
            </Link>
          ) : (
            <span className="font-medium text-brand-600 dark:text-brand-300">{d.target}</span>
          )}
        </p>
        {isCommentAction && d.comment ? (
          <blockquote className="mt-2 border-l-[3px] border-brand-500/60 pl-3 pr-2 py-1.5 rounded-r-md bg-brand-500/5 dark:bg-brand-500/10">
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
              <span className="text-foreground/50 select-none">“</span>
              {d.comment}
              <span className="text-foreground/50 select-none">”</span>
            </p>
          </blockquote>
        ) : null}
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1 flex-wrap">
          {projectHref && d.project !== d.target ? (
            <Link
              to={projectHref}
              className="text-brand-600/80 dark:text-brand-300/80 hover:text-brand-700 dark:hover:text-brand-200 hover:underline underline-offset-2"
              title="Abrir proyecto">
              {d.project}
            </Link>
          ) : (
            <span>{d.project}</span>
          )}
          <span className="text-muted-foreground">·</span>
          <span>{d.time}</span>
        </p>
      </div>
    </div>
  )
}

const PAGE_SIZE = 20

export default function ActivityPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const q = useQuery<ActivityResponse, Error, ActivityResponse>({
    queryKey: ['activity', { page, pageSize: PAGE_SIZE }],
    queryFn: () => fetchActivity({ page, pageSize: PAGE_SIZE }),
    staleTime: 30_000,
    retry: 1,
    placeholderData: keepPreviousData,
  })
  const isLoading = q.isLoading && q.fetchStatus !== 'idle'
  const items: ActivityItem[] = q.data?.items ?? []
  const total = q.data?.total ?? 0
  const totalPages = q.data?.totalPages ?? Math.max(1, Math.ceil(total / PAGE_SIZE))
  const source = q.data?.source

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(total, page * PAGE_SIZE)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-brand-500 dark:text-brand-400" />
            <h1 className="text-2xl font-bold text-foreground">Actividad</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Todos los eventos de tu organización, de más reciente a más antiguo.
            {source ? <span className="ml-2 text-xs text-muted-foreground">({source === 'auditoria' ? 'Auditoría SQL' : 'Vista combinada'})</span> : null}
          </p>
        </div>
        <button className="btn-ghost text-xs" onClick={() => navigate(-1)}>
          ← Volver
        </button>
      </div>

      <div className="card">
        <div className="divide-y divide-border">
          {q.isError ? (
            <div className="p-8 text-center text-sm text-destructive/90">
              No se pudo cargar la actividad. Inténtalo de nuevo.
              <div className="mt-3">
                <button className="btn-primary text-xs" onClick={() => q.refetch()}>
                  Reintentar
                </button>
              </div>
            </div>
          ) : isLoading && items.length === 0 ? (
            Array.from({ length: 8 }).map((_, i) => <ActivityRowSkeleton key={`sk-ac-${i}`} />)
          ) : items.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <History className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Aún no hay actividad registrada en tu organización.
              </p>
            </div>
          ) : (
            <>
              {items.map((a: ActivityItem) => <ActivityRow key={`ac-${a.id}`} a={a} />)}
              {q.isFetching && q.isPlaceholderData
                ? Array.from({ length: 2 }).map((_, i) => (
                    <ActivityRowSkeleton key={`sk-mor-${i}`} />
                  ))
                : null}
            </>
          )}
        </div>

        <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            {total === 0
              ? 'Sin eventos'
              : `Mostrando ${from}-${to} de ${total} ${total === 1 ? 'evento' : 'eventos'} · Página ${page} de ${totalPages}`
            }
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost text-xs !px-2"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}>
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <button
              className="btn-ghost text-xs !px-2"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}>
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
