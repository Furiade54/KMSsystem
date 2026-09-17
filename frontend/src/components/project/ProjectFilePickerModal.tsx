import { X, Search, Loader2, Link2 } from 'lucide-react'
import clsx from 'clsx'
import type { ApiFile } from '@/services/files.service'
import { fileKind, formatBytes } from '@/services/files.service'
import { formatRelativeTime } from '@/services/projects.service'
import { colorForKind, iconForKind } from './fileHelpers'

export type PickerMode = 'meeting' | 'aporte'

export type ProjectFilePickerModalProps = {
  open: boolean
  pickerMode: PickerMode
  filePickerSearch: string
  setFilePickerSearch: (v: string) => void
  filesLoading: boolean
  filesError: boolean
  files: ApiFile[] | undefined
  linkPending: boolean
  expandedMeetingId: string | null
  onClose: () => void
  onSelect: (fileId: string, file: ApiFile) => void
}

export default function ProjectFilePickerModal(props: ProjectFilePickerModalProps) {
  const {
    open,
    pickerMode,
    filePickerSearch,
    setFilePickerSearch,
    filesLoading,
    filesError,
    files,
    linkPending,
    expandedMeetingId,
    onClose,
    onSelect,
  } = props
  const title =
    pickerMode === 'meeting'
      ? 'Seleccionar archivo del acta'
      : 'Seleccionar archivo adjunto'
  const subtitle =
    pickerMode === 'meeting'
      ? 'Escoge un archivo existente del proyecto para enlazarlo como acta de la reunión.'
      : 'Escoge un archivo existente del proyecto para enlazarlo como adjunto del aporte.'
  if (!open) return null
  const canClickRow = (): boolean => {
    if (pickerMode === 'meeting') return Boolean(expandedMeetingId && !linkPending)
    return !linkPending
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => {
        if (linkPending) return
        onClose()
      }}
    >
      <div className="card w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-secondary/40">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          <button
            type="button"
            className="btn-ghost p-1 rounded-md h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-brand-500/60 focus:outline-none"
            onClick={() => {
              if (linkPending) return
              onClose()
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 pt-3 pb-2 border-b border-border/70">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              value={filePickerSearch}
              onChange={(e) => setFilePickerSearch(e.target.value)}
              placeholder="Buscar por nombre de archivo..."
              className="w-full h-8 pl-7 pr-2 text-[11.5px] rounded-md bg-surface-secondary/70 border border-border/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/60"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1">
          {filesLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-2.5 flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-md bg-surface-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-5/6 bg-surface-secondary rounded" />
                  <div className="h-2.5 w-2/3 bg-surface-secondary rounded" />
                </div>
              </div>
            ))
          ) : filesError ? (
            <div className="p-5 text-center text-[11.5px] text-muted-foreground">
              No se pudieron cargar los archivos.
            </div>
          ) : !(files ?? []).length ? (
            <div className="p-5 text-center text-[11.5px] text-muted-foreground">
              No hay archivos en este proyecto. Sube primero el archivo en la pestaña Documentos.
            </div>
          ) : (
            (files ?? []).map((f) => {
              const rowDisabled = pickerMode === 'meeting' ? linkPending : false
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    if (!canClickRow()) return
                    onSelect(f.id, f)
                  }}
                  disabled={rowDisabled}
                  className="w-full text-left p-2.5 flex items-center gap-3 rounded-md hover:bg-surface-secondary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div
                    className={clsx(
                      'w-8 h-8 rounded-md flex items-center justify-center shrink-0 ring-1 ring-black/5 shadow-sm',
                      colorForKind(fileKind(f))
                    )}
                  >
                    {(() => {
                      const Ic = iconForKind(fileKind(f))
                      return <Ic className="w-4 h-4 text-white/95" />
                    })()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-foreground truncate">{f.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {typeof f.sizeBytes === 'number' ? formatBytes(f.sizeBytes) : '—'}
                      {f.extension ? ` · ${f.extension}` : ''}
                      {f.createdAt ? ` · Subido ${formatRelativeTime(f.createdAt)}` : ''}
                    </p>
                  </div>
                  {linkPending ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Link2 className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
