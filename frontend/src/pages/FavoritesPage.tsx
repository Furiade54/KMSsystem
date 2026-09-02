import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Star,
  FolderKanban,
  Folder,
  FileText,
  FileSpreadsheet,
  Presentation,
  Film,
  Music,
  Image as ImageIcon,
  FileArchive,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowUpDown,
  Filter,
  Link2,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  type FavoriteItem,
  type FavoriteResourceType,
  listFavorites,
  toggleFavorite,
} from '../services/favorites.service'
import { formatRelativeTime } from '../services/projects.service'

type FilterType = 'ALL' | FavoriteResourceType
type SortKey = 'createdAt' | 'name' | 'projectName' | 'type'

const FILTERS: Array<{ key: FilterType; label: string; icon: typeof FolderKanban; accent: string }> = [
  { key: 'ALL', label: 'Todo', icon: Star, accent: 'text-status-review' },
  { key: 'PROJECT', label: 'Proyectos', icon: FolderKanban, accent: 'text-brand-500' },
  { key: 'FOLDER', label: 'Carpetas', icon: Folder, accent: 'text-amber-500' },
  { key: 'FILE', label: 'Documentos', icon: FileText, accent: 'text-emerald-500' },
]

function fileIconFor(ext: string | null, mime: string | null): typeof FileText {
  const e = (ext || '').toLowerCase().replace(/^\./, '')
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(e)) return ImageIcon
  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(e) || (mime || '').startsWith('video/')) return Film
  if (['mp3', 'wav', 'flac', 'ogg', 'aac'].includes(e) || (mime || '').startsWith('audio/')) return Music
  if (['xlsx', 'xls', 'csv', 'ods'].includes(e)) return FileSpreadsheet
  if (['pptx', 'ppt', 'key'].includes(e)) return Presentation
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return FileArchive
  return FileText
}

function resourceMeta(item: FavoriteItem) {
  if (item.resourceType === 'PROJECT') return { Icon: FolderKanban, iconColor: 'text-brand-500', iconBg: 'bg-brand-500/15', typeLabel: 'Proyecto' }
  if (item.resourceType === 'FOLDER') return { Icon: Folder, iconColor: 'text-amber-500', iconBg: 'bg-amber-500/15', typeLabel: 'Carpeta' }
  const Icon = fileIconFor(item.extension, item.mime)
  return { Icon, iconColor: 'text-emerald-500', iconBg: 'bg-emerald-500/15', typeLabel: item.extension ? item.extension.replace(/^\./, '').toUpperCase() : 'Documento' }
}

function FavoritesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [filter, setFilter] = useState<FilterType>('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const resourceType = filter === 'ALL' ? undefined : filter
  const params = useMemo(
    () => ({ resourceType, page, pageSize }),
    [resourceType, page, pageSize]
  )

  const query = useQuery({
    queryKey: ['favorites', 'list', params],
    queryFn: () => listFavorites(params),
    placeholderData: (prev) => prev,
  })

  useEffect(() => {
    setPage(1)
  }, [filter, pageSize])

  const filteredSorted = useMemo(() => {
    const items = query.data?.items ?? []
    const q = search.trim().toLowerCase()
    const list = !q ? items : items.filter((it) => {
      const hay = [
        it.name,
        it.projectName,
        it.folderName,
        it.extension,
        it.mime,
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
    const dir = sortDir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      if (sortBy === 'name') return String(a.name || '').localeCompare(String(b.name || '')) * dir
      if (sortBy === 'projectName') return String(a.projectName || '').localeCompare(String(b.projectName || '')) * dir
      if (sortBy === 'type') return a.resourceType.localeCompare(b.resourceType) * dir
      // createdAt
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir
    })
  }, [query.data, search, sortBy, sortDir])

  const toggleMut = useMutation({
    mutationFn: (item: FavoriteItem) => toggleFavorite({ resourceType: item.resourceType, resourceId: item.resourceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
      queryClient.invalidateQueries({ queryKey: ['favorite', 'check'] })
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || 'No se pudo actualizar el favorito')
    },
  })

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / pageSize)) : 1

  const counts = useMemo(() => {
    const items = query.data?.items ?? []
    return {
      ALL: query.data?.total ?? 0,
      PROJECT: items.filter((i) => i.resourceType === 'PROJECT').length,
      FOLDER: items.filter((i) => i.resourceType === 'FOLDER').length,
      FILE: items.filter((i) => i.resourceType === 'FILE').length,
    }
  }, [query.data])

  function openItem(item: FavoriteItem) {
    if (item.resourceType === 'PROJECT') {
      navigate(`/projects/${item.resourceId}`)
      return
    }
    if (item.projectId) {
      navigate(`/projects/${item.projectId}`, {
        state:
          item.resourceType === 'FOLDER'
            ? { folderId: item.resourceId }
            : { fileId: item.resourceId, folderId: item.folderId ?? undefined },
      })
    }
  }

  return (
    <div className="h-full w-full flex flex-col bg-background">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Star className="w-3.5 h-3.5 text-status-review" />
              Espacio personal
            </div>
            <h1 className="text-xl font-bold text-foreground mt-1">Favoritos</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Tus recursos marcados con ⭐, agrupados por tipo
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Buscar en favoritos..."
                className="input-base pl-8 pr-2.5 h-8 text-xs w-64 rounded-md border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
              />
            </div>
            <select
              value={`${sortBy}:${sortDir}`}
              onChange={(e) => {
                const [sb, sd] = e.target.value.split(':') as [SortKey, 'asc' | 'desc']
                setSortBy(sb)
                setSortDir(sd)
              }}
              className="input-base h-8 text-xs rounded-md border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 bg-surface"
            >
              <option value="createdAt:desc">Más recientes</option>
              <option value="createdAt:asc">Más antiguos</option>
              <option value="name:asc">Nombre (A-Z)</option>
              <option value="name:desc">Nombre (Z-A)</option>
              <option value="projectName:asc">Proyecto (A-Z)</option>
              <option value="type:asc">Tipo</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-1.5 flex-wrap">
          {FILTERS.map((f) => {
            const Icon = f.icon
            const active = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={clsx(
                  'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
                  active
                    ? 'bg-surface-secondary border-border text-foreground shadow-sm'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-surface-secondary/60'
                )}
              >
                <Icon className={clsx('w-3.5 h-3.5', f.accent)} />
                <span className="font-medium">{f.label}</span>
                <span className="text-[10.5px] tabular-nums px-1.5 rounded-full bg-surface/70 ring-1 ring-border/70 text-muted-foreground">
                  {counts[f.key] ?? 0}
                </span>
              </button>
            )
          })}
          <div className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-muted-foreground">
            <Filter className="w-3 h-3" />
            <span>
              {search ? `${filteredSorted.length} de ` : ''}
              {query.data?.total ?? 0} resultado
              {(query.data?.total ?? 0) === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-6xl mx-auto p-6 space-y-8">
          {(['PROJECT', 'FOLDER', 'FILE'] as const).map((groupKey) => {
            const groupItems = filteredSorted.filter((i) => i.resourceType === groupKey)
            if (filter !== 'ALL' && filter !== groupKey) return null
            if (groupItems.length === 0 && filter === 'ALL') return null
            if (groupItems.length === 0 && filter === groupKey) {
              const label = FILTERS.find((f) => f.key === groupKey)?.label ?? groupKey
              return (
                <div key={groupKey} className="card p-8 text-center text-muted-foreground text-sm">
                  No hay {label.toLowerCase()} en favoritos.
                </div>
              )
            }
            const group = FILTERS.find((f) => f.key === groupKey)!
            const Icon = group.icon
            return (
              <section key={groupKey} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={clsx('w-4 h-4', group.accent)} />
                    <h2 className="text-sm font-semibold text-foreground tracking-wide uppercase">
                      {group.label}
                    </h2>
                    <span className="text-[10.5px] tabular-nums text-muted-foreground">
                      {groupItems.length}
                    </span>
                  </div>
                </div>

                <div className="card divide-y divide-border/60 overflow-hidden">
                  {groupItems.map((item) => {
                    const meta = resourceMeta(item)
                    const Icon = meta.Icon
                    const crumb = [
                      item.projectName ? { to: `/projects/${item.projectId}`, label: item.projectName } : null,
                      item.resourceType === 'FILE' && item.folderId && item.folderName
                        ? { to: `/projects/${item.projectId}`, label: item.folderName, state: { folderId: item.folderId } }
                        : null,
                    ].filter(Boolean) as Array<{ to: string; label: string; state?: unknown }>

                    return (
                      <article
                        key={`${item.resourceType}-${item.resourceId}`}
                        className="group p-3.5 flex items-center gap-3 hover:bg-surface-secondary/40 cursor-pointer transition-colors"
                        onClick={() => openItem(item)}
                      >
                        <div
                          className={clsx(
                            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ring-1 ring-black/5 shadow-sm',
                            meta.iconBg
                          )}
                        >
                          <Icon className={clsx('w-5 h-5', meta.iconColor)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-foreground truncate text-[13.5px]">
                              {item.name ?? 'Sin nombre'}
                            </h3>
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground rounded-md bg-surface-secondary/70 border border-border/60 px-1.5 h-5 inline-flex items-center shrink-0">
                              {meta.typeLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <ArrowUpDown className="w-3 h-3 opacity-70" />
                              Añadido {formatRelativeTime(item.createdAt)}
                            </span>
                            {crumb.length > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <Link2 className="w-3 h-3 opacity-70" />
                                {crumb.map((c, idx) => (
                                  <span key={idx} className="inline-flex items-center gap-1">
                                    {idx > 0 && <ChevronRight className="w-3 h-3 opacity-70" />}
                                    <span className="truncate max-w-[180px]">{c.label}</span>
                                  </span>
                                ))}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleMut.mutate(item)
                          }}
                          disabled={toggleMut.isPending && toggleMut.variables?.resourceId === item.resourceId && toggleMut.variables?.resourceType === item.resourceType}
                          className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-md text-status-review hover:bg-status-review/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-status-review/50"
                          aria-label="Quitar de favoritos"
                          title="Quitar de favoritos"
                        >
                          {toggleMut.isPending && toggleMut.variables?.resourceId === item.resourceId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Star className="w-4 h-4 fill-current" />
                          )}
                        </button>
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}

          {query.isLoading && !query.data && (
            <div className="card p-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
              <span className="text-xs text-muted-foreground">Cargando favoritos...</span>
            </div>
          )}

          {!query.isLoading && filteredSorted.length === 0 && (
            <div className="card p-16 text-center space-y-4">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-3xl bg-status-review/15 blur-xl" />
                <div className="relative w-20 h-20 rounded-3xl bg-surface-secondary ring-1 ring-status-review/30 flex items-center justify-center">
                  <Star className="w-10 h-10 text-status-review" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                {search ? 'Sin resultados' : filter === 'ALL' ? 'Aún no tienes elementos favoritos' : 'Sin favoritos en esta categoría'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {search
                  ? 'Prueba con otros términos o cambia los filtros.'
                  : 'Marca proyectos, carpetas y documentos con ⭐ para acceder rápidamente a ellos desde aquí.'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border px-6 py-3 flex items-center justify-between text-[11.5px] text-muted-foreground">
        <div>
          Mostrando {Math.min((page - 1) * pageSize + 1, query.data?.total ?? 0)}–
          {Math.min(page * pageSize, query.data?.total ?? 0)} de {query.data?.total ?? 0}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) || 50)}
            className="input-base h-8 px-2 text-[11px] rounded-md border-border bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
          >
            {[20, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n} por página
              </option>
            ))}
          </select>
          <button
            disabled={page <= 1 || query.isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="btn-secondary h-8 px-2 disabled:opacity-50"
            aria-label="Página anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="tabular-nums">
            Página <strong className="text-foreground">{page}</strong> / {totalPages}
          </span>
          <button
            disabled={page >= totalPages || query.isFetching}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="btn-secondary h-8 px-2 disabled:opacity-50"
            aria-label="Página siguiente"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default FavoritesPage
