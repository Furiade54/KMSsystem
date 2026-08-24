import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  FileImage,
  FileSpreadsheet,
  File,
  FileArchive,
  Presentation,
  Film,
  Music,
  Link as LinkIcon,
} from 'lucide-react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  ApiFile,
  fetchFiles,
  fileKind,
  formatBytes,
} from '../services/files.service'
import { formatRelativeTime } from '../services/projects.service'

const PAGE_SIZE = 20

function fileIcon(f: ApiFile) {
  const k = fileKind(f)
  switch (k) {
    case 'image':
      return <FileImage className="w-5 h-5 text-emerald-400" />
    case 'sheet':
      return <FileSpreadsheet className="w-5 h-5 text-status-approved" />
    case 'slide':
      return <Presentation className="w-5 h-5 text-amber-400" />
    case 'video':
      return <Film className="w-5 h-5 text-purple-400" />
    case 'audio':
      return <Music className="w-5 h-5 text-pink-400" />
    case 'zip':
      return <FileArchive className="w-5 h-5 text-orange-400" />
    case 'link':
      return <LinkIcon className="w-5 h-5 text-sky-400" />
    case 'pdf':
    case 'doc':
    case 'file':
    default:
      return <File className="w-5 h-5 text-brand-300" />
  }
}

function DocumentsPage() {
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [searchDebounced])

  const query = useQuery({
    queryKey: ['files', 'mine', { page, search: searchDebounced }],
    queryFn: () =>
      fetchFiles({
        mine: true,
        page,
        pageSize: PAGE_SIZE,
        search: searchDebounced || undefined,
      }),
    staleTime: 60_000,
    retry: 1,
    placeholderData: keepPreviousData,
  })

  const items = query.data?.items ?? []
  const total = query.data?.total ?? 0
  const totalPages = query.data?.totalPages ?? 1
  const isLoading = query.isLoading && query.fetchStatus !== 'idle'
  const isEmpty = !isLoading && items.length === 0

  const headerTotal = useMemo(() => {
    if (isLoading) return '…'
    if (query.isFetching && total === 0) return '…'
    return String(total)
  }, [isLoading, total, query.isFetching])

  const handleDownload = (f: ApiFile) => {
    window.open(f.downloadUrl, '_blank', 'noopener')
  }

  return (
    <div className="p-6 w-full max-w-full mx-auto space-y-6 overflow-x-hidden min-w-0">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground truncate" title="Mis documentos">Mis documentos</h1>
          <p className="text-muted-foreground text-sm mt-1 truncate">
            {headerTotal} archivos · Subidos por ti
          </p>
        </div>
      </div>

      <div className="card p-3 flex items-center gap-2 flex-wrap min-w-0">
        <div className="relative flex-1 min-w-[200px] w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar entre tus documentos..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input-base pl-10 py-1.5 text-sm w-full min-w-0"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="card divide-y divide-border min-w-0 w-full">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4 animate-pulse min-w-0">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-surface-secondary" />
              <div className="flex-1 space-y-2 min-w-0">
                <div className="h-4 w-1/3 bg-surface-secondary rounded truncate" />
                <div className="h-3 w-2/3 bg-surface-secondary rounded truncate" />
              </div>
              <div className="h-3 w-20 bg-surface-secondary rounded shrink-0 hidden sm:block" />
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <div className="card p-10 text-center space-y-3 min-w-0 w-full">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-secondary flex items-center justify-center shrink-0">
            <FileText className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-foreground font-semibold">No tienes documentos aún</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {searchDebounced
              ? 'Ningún archivo coincide con tu búsqueda. Prueba con otros términos.'
              : 'Sube tu primer documento a cualquier proyecto para que aparezca aquí.'}
          </p>
          {searchDebounced && (
            <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
              <button
                className="btn-secondary text-sm"
                onClick={() => {
                  setSearchInput('')
                  setSearchDebounced('')
                }}
              >
                Limpiar búsqueda
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="card divide-y divide-border min-w-0 w-full">
          {items.map((f) => (
            <div
              key={f.id}
              className="p-3 sm:p-4 flex items-start sm:items-center gap-3 sm:gap-4 hover:bg-surface-secondary/40 transition-colors min-w-0 w-full"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-surface-secondary flex items-center justify-center">
                {fileIcon(f)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap min-w-0 w-full">
                  <h3
                    className="font-semibold text-foreground truncate min-w-0 flex-1 max-w-full"
                    title={f.name}
                  >
                    {f.name}
                  </h3>
                  {f.projectName && (
                    <Link
                      to={`/projects/${f.projectId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-200 truncate max-w-[200px] shrink-0"
                      title={`Ir al proyecto: ${f.projectName}`}
                    >
                      <FolderKanban className="w-3 h-3 shrink-0" />
                      <span className="truncate">{f.projectName}</span>
                    </Link>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-muted-foreground min-w-0 w-full tabular-nums">
                  <span className="truncate">{formatBytes(f.sizeBytes)}</span>
                  <span className="shrink-0 opacity-60">·</span>
                  <span className="truncate">{formatRelativeTime(f.updatedAt ?? f.createdAt)}</span>
                  {f.ownerName && (
                    <>
                      <span className="shrink-0 opacity-60">·</span>
                      <span className="truncate max-w-[60%]" title={`Subido por ${f.ownerName}`}>Subido por {f.ownerName}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-auto self-center">
                <button
                  className={clsx('btn-secondary text-xs sm:text-sm py-1 sm:py-1.5 whitespace-nowrap', !f.downloadUrl && 'opacity-50 cursor-not-allowed')}
                  disabled={!f.downloadUrl}
                  onClick={() => handleDownload(f)}
                  title={f.downloadUrl ? `Descargar ${f.name}` : 'Descarga no disponible'}
                >
                  <Download className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  <span className="hidden sm:inline">Descargar</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && totalPages > 1 && (
        <div className="card p-3 flex flex-wrap items-center justify-between gap-3 min-w-0 w-full">
          <div className="text-xs text-muted-foreground min-w-0 truncate">
            Página {page} de {totalPages} · {total} resultados
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="btn-secondary text-sm py-1.5 disabled:opacity-50 whitespace-nowrap"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            <button
              className="btn-secondary text-sm py-1.5 disabled:opacity-50 whitespace-nowrap"
              disabled={page >= totalPages || query.isFetching}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentsPage
