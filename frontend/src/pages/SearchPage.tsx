import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  FolderKanban,
  Folder,
  File,
  Users,
  Search as SearchIcon,
  ArrowRight,
  Filter,
  Loader2,
} from 'lucide-react'
import clsx from 'clsx'
import {
  globalSearch,
  SearchHit,
  SearchHitType,
  labelForHitType,
} from '../services/search.service'
import { formatRelativeTime } from '../services/projects.service'

const TYPE_ORDER: SearchHitType[] = ['project', 'folder', 'file', 'user']

function iconForType(t: SearchHitType) {
  switch (t) {
    case 'project':
      return FolderKanban
    case 'folder':
      return Folder
    case 'file':
      return File
    case 'user':
      return Users
  }
}

function colorForType(t: SearchHitType): string {
  switch (t) {
    case 'project':
      return 'text-brand-300 bg-brand-500/20'
    case 'folder':
      return 'text-status-review bg-status-review/20'
    case 'file':
      return 'text-indigo-300 bg-indigo-500/20'
    case 'user':
      return 'text-emerald-300 bg-emerald-500/20'
  }
}

function navigateForHit(hit: SearchHit) {
  switch (hit.type) {
    case 'project':
      return `/projects/${hit.id}`
    case 'folder':
    case 'file':
      if (!hit.projectId) return null
      return `/projects/${hit.projectId}`
    case 'user':
      return null
  }
}

function HitRow({ hit, onClick }: { hit: SearchHit; onClick: (to: string) => void }) {
  const Ic = iconForType(hit.type)
  const to = navigateForHit(hit)
  const clickable = Boolean(to)
  return (
    <div
      onClick={clickable && to ? () => onClick(to!) : undefined}
      className={clsx(
        'p-3 border-b border-border/50 flex items-start gap-3',
        clickable ? 'hover:bg-surface-secondary/50 cursor-pointer transition-colors' : 'cursor-default',
      )}
    >
      <div
        className={clsx(
          'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
          colorForType(hit.type),
        )}
      >
        <Ic className="w-4.5 h-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{hit.name}</p>
          {hit.type === 'user' && hit.path ? (
            <span className="text-[11px] text-muted-foreground truncate">· {hit.path}</span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className={clsx('px-1.5 py-0.5 rounded text-[10px]', colorForType(hit.type))}>
            {labelForHitType(hit.type).label.slice(0, -1)}
          </span>
          {hit.updatedAt ? <span>{formatRelativeTime(hit.updatedAt)}</span> : null}
        </div>
      </div>
      {clickable ? (
        <div className="text-muted-foreground group-hover:text-foreground">
          <ArrowRight className="w-4 h-4" />
        </div>
      ) : null}
    </div>
  )
}

function GroupSection({
  type,
  hits,
  onHitClick,
}: {
  type: SearchHitType
  hits: SearchHit[]
  onHitClick: (to: string) => void
}) {
  if (hits.length === 0) return null
  const label = labelForHitType(type)
  const Ic = iconForType(type)
  return (
    <section className="card overflow-hidden">
      <header className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ic className="w-4 h-4 text-brand-500 dark:text-brand-400" />
          <h3 className="font-semibold text-foreground">{label.label}</h3>
          <span className="text-xs text-muted-foreground">
            {hits.length} {hits.length === 1 ? 'resultado' : 'resultados'}
          </span>
        </div>
      </header>
      <div className="divide-y divide-border/0">
        {hits.slice(0, 20).map((h) => (
          <HitRow key={`${h.type}-${h.id}`} hit={h} onClick={onHitClick} />
        ))}
      </div>
    </section>
  )
}

function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="card overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={`sk-${i}`} className="p-3 border-b border-border/50 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface-secondary animate-pulse shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-2/3 bg-surface-secondary rounded animate-pulse" />
            <div className="h-3 w-1/4 bg-surface-secondary rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const qFromUrl = params.get('q') || ''
  const [input, setInput] = useState(qFromUrl)

  useEffect(() => {
    setInput(qFromUrl)
  }, [qFromUrl])

  const [debounced, setDebounced] = useState(qFromUrl)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(input.trim())
      if (input.trim()) {
        setParams({ q: input.trim() }, { replace: true })
      }
    }, 400)
    return () => clearTimeout(t)
  }, [input, setParams])

  const enabled = debounced.length >= 2
  const query = useQuery({
    queryKey: ['search', 'global', debounced],
    queryFn: () => globalSearch({ q: debounced, limit: 40 }),
    enabled,
    staleTime: 30_000,
    retry: 1,
  })

  const grouped = useMemo(() => {
    const g: Record<SearchHitType, SearchHit[]> = {
      project: [],
      folder: [],
      file: [],
      user: [],
    }
    ;(query.data?.items || []).forEach((h) => {
      if (g[h.type]) g[h.type].push(h)
    })
    return g
  }, [query.data])

  const totalCount = TYPE_ORDER.reduce((s, t) => s + grouped[t].length, 0)
  const isLoading = enabled && query.isLoading && query.fetchStatus !== 'idle'

  const onHitClick = (to: string) => navigate(to)
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = input.trim()
    if (v.length < 2) return
    setParams({ q: v }, { replace: true })
    setDebounced(v)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="space-y-1">
        <nav className="text-xs text-muted-foreground">
          <Link to="/dashboard" className="hover:text-brand-600 dark:hover:text-brand-300 transition-colors">
            Inicio
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">Búsqueda</span>
          {debounced ? (
            <>
              <span className="mx-2">/</span>
              <span className="text-foreground">"{debounced}"</span>
            </>
          ) : null}
        </nav>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <SearchIcon className="w-5 h-5 text-brand-500 dark:text-brand-400" />
          Búsqueda global
        </h1>
        <p className="text-muted-foreground text-sm">
          Encuentra proyectos, carpetas, documentos y usuarios en tu organización.
        </p>
      </div>

      <form onSubmit={onSubmit} className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          autoFocus
          placeholder="Escribe al menos 2 caracteres… ej: ISO, LMS, Fortigate, María"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full h-12 pl-11 pr-4 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition"
        />
        {isLoading ? (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-500 dark:text-brand-400 animate-spin" />
        ) : null}
      </form>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5" />
          <span>
            {enabled ? (isLoading ? 'Buscando…' : `Mostrando ${totalCount} de ${query.data?.total ?? 0}`) : 'Introduce tu búsqueda'}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          {TYPE_ORDER.map((t) => {
            const L = labelForHitType(t)
            return (
              <span key={t} className={clsx('px-1.5 py-0.5 rounded', colorForType(t))}>
                {L.label} {grouped[t].length}
              </span>
            )
          })}
        </div>
      </div>

      {query.isError ? (
        <div className="card p-6 text-center text-sm text-destructive/90">
          No se pudo realizar la búsqueda. Inténtalo de nuevo.
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          {TYPE_ORDER.map((t) => (
            <SkeletonRows key={`skg-${t}`} count={3} />
          ))}
        </div>
      ) : !enabled ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-secondary flex items-center justify-center mb-3">
            <SearchIcon className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground">¿Qué estás buscando hoy?</p>
          <p className="text-muted-foreground text-sm mt-1 max-w-md mx-auto">
            Escribe el nombre de un proyecto, carpeta, documento o usuario para empezar.
          </p>
        </div>
      ) : totalCount === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-secondary flex items-center justify-center mb-3">
            <SearchIcon className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground">Sin resultados para "{debounced}"</p>
          <p className="text-muted-foreground text-sm mt-1 max-w-md mx-auto">
            Prueba con otras palabras o revisa la ortografía.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {TYPE_ORDER.map((t) => (
            <GroupSection
              key={t}
              type={t}
              hits={grouped[t]}
              onHitClick={onHitClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}
