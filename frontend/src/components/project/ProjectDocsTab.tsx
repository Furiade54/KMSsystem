import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import clsx from 'clsx'
import {
  FolderKanban,
  ChevronRight,
  Search,
  Star,
  Plus,
  Loader2,
  Folder,
  FileCheck2,
} from 'lucide-react'
import type { ApiFolder, FolderNode } from '@/services/folders.service'
import type { ApiFile } from '@/services/files.service'
import { formatBytes } from '@/services/files.service'
import { formatRelativeTime } from '@/services/projects.service'
import type { FavoriteResourceType } from '@/services/favorites.service'
import { colorForKind, iconForKind } from './fileHelpers'
import { fileKind } from '@/services/files.service'
import { FolderTreeItem } from './FolderTreeItem'

type SelectedResourceType = 'file' | 'folder'

export type ProjectDocsTabProps = {
  isResizing: boolean
  treeWidth: number
  TREE_MIN_W: number
  TREE_MAX_W: number
  startResize: (e: ReactPointerEvent) => void
  resizerOnKey: (e: ReactKeyboardEvent) => void

  folderTree: FolderNode[]
  foldersAreLoading: boolean
  selectedFolderId: string | null
  setSelectedFolderId: (v: string | null) => void
  docMaestroCarpetaId: string | null | undefined

  setFolderContextMenu: (v: { folder: ApiFolder; x: number; y: number } | null) => void
  setFileContextMenu: (v: { file: ApiFile; x: number; y: number } | null) => void
  setDocsAreaContextMenu: (v: { x: number; y: number } | null) => void

  setSelectedResource: (r: { type: SelectedResourceType; id: string; projectId: string }) => void

  breadcrumbChain: ApiFolder[]
  visibleFoldersCurrentLevel: ApiFolder[]

  docsSearchInput: string
  setDocsSearchInput: (v: string) => void

  project: { id?: string; docMaestroCarpetaId?: string | null; docMaestroArchivoId?: string | null } | null | undefined

  createFolderMutationPending: boolean
  setShowNewFolder: (v: boolean) => void
  setNewFolderName: (v: string) => void
  setNewFolderError: (v: string) => void

  filesIsLoading: boolean
  filesItems: ApiFile[] | undefined

  handleToggleFavorite: (
    resourceType: FavoriteResourceType,
    resourceId: string,
    currentLocal?: boolean | undefined
  ) => void
  isLocalFavorite: (resourceType: FavoriteResourceType, resourceId: string) => boolean | undefined

  selectedId: string | undefined
  selectedType: SelectedResourceType | undefined
  projectId: string
}

export default function ProjectDocsTab(props: ProjectDocsTabProps) {
  const {
    isResizing,
    treeWidth,
    TREE_MIN_W,
    TREE_MAX_W,
    startResize,
    resizerOnKey,
    folderTree,
    foldersAreLoading,
    selectedFolderId,
    setSelectedFolderId,
    docMaestroCarpetaId,
    setFolderContextMenu,
    setFileContextMenu,
    setDocsAreaContextMenu,
    setSelectedResource,
    breadcrumbChain,
    visibleFoldersCurrentLevel,
    docsSearchInput,
    setDocsSearchInput,
    project,
    createFolderMutationPending,
    setShowNewFolder,
    setNewFolderName,
    setNewFolderError,
    filesIsLoading,
    filesItems,
    handleToggleFavorite,
    isLocalFavorite,
    selectedId,
    selectedType,
    projectId,
  } = props

  return (
    <div
      className={clsx(
        'flex-1 flex overflow-hidden min-h-0',
        isResizing && 'select-none'
      )}
    >
      <aside
        className="shrink-0 border-r border-border bg-surface-primary/40 overflow-hidden hidden md:flex flex-col"
        style={{ width: `${treeWidth}px` }}
        onContextMenu={(e) => {
          if (e.target !== e.currentTarget) {
            const t = e.target as HTMLElement
            if (t.closest('button') || t.closest('[data-sidebar-item]')) return
          }
          e.preventDefault()
          setFolderContextMenu(null)
          setFileContextMenu(null)
          setDocsAreaContextMenu({ x: e.clientX, y: e.clientY })
        }}
        aria-label="Árbol de carpetas del proyecto"
      >
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-border bg-surface/95 backdrop-blur sticky top-0 z-10 mb-1 shadow-[0_1px_0_0_rgba(0,0,0,0.03)] shrink-0">
          <div className="text-[9.5px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
            Árbol de carpetas
          </div>
          <div className="text-[9.5px] text-muted-foreground/60 tabular-nums" title="Carpetas">
            {folderTree.length > 0 ? folderTree.length : '—'}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin p-2 space-y-0.5" role="tree">
          <button
            role="treeitem"
            aria-selected={selectedFolderId == null}
            onClick={() => setSelectedFolderId(null)}
            onContextMenu={(e) => e.stopPropagation()}
            className={clsx(
              'w-full flex items-center gap-1.5 px-1.5 rounded-md text-[11.5px] text-left transition-colors h-8 min-w-[32px] group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60',
              selectedFolderId == null
                ? 'bg-brand-500/18 text-brand-700 dark:text-brand-300 ring-1 ring-brand-500/35 shadow-sm'
                : 'text-foreground hover:bg-surface-secondary'
            )}
          >
            <FolderKanban className="w-3.5 h-3.5 text-brand-500 dark:text-brand-400 shrink-0" />
            <span className="truncate font-medium">Raíz del proyecto</span>
          </button>

          {foldersAreLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={`skel-${i}`}
                  className="flex items-center gap-1.5 px-1.5 rounded-md opacity-60 h-8"
                  aria-hidden="true"
                >
                  <div className="w-3.5 h-3.5 rounded bg-surface-secondary animate-pulse shrink-0" />
                  <div className="h-2.5 flex-1 bg-surface-secondary rounded animate-pulse" />
                </div>
              ))
            : folderTree.length === 0
              ? (
                  <div className="px-1.5 py-2 text-[10.5px] text-muted-foreground leading-relaxed">
                    Sin carpetas aún. Usa <span className="font-medium text-foreground">“+ Nueva carpeta”</span> a la derecha.
                  </div>
                )
              : folderTree.map((node) => (
                  <FolderTreeItem
                    key={node.id}
                    node={node}
                    depth={0}
                    selectedFolderId={selectedFolderId}
                    docMaestroCarpetaId={docMaestroCarpetaId ?? null}
                    onSelect={(n) => {
                      setSelectedFolderId(n.id)
                      setSelectedResource({
                        type: 'folder',
                        id: n.id,
                        projectId,
                      })
                    }}
                    onContextMenu={(e, n) => {
                      e.preventDefault()
                      setSelectedFolderId(n.id)
                      setSelectedResource({
                        type: 'folder',
                        id: n.id,
                        projectId,
                      })
                      setFolderContextMenu({
                        folder: n,
                        x: e.clientX,
                        y: e.clientY,
                      })
                    }}
                  />
                ))}
        </div>
      </aside>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar panel de carpetas"
        aria-valuemin={TREE_MIN_W}
        aria-valuemax={TREE_MAX_W}
        aria-valuenow={treeWidth}
        tabIndex={0}
        onPointerDown={startResize}
        onKeyDown={resizerOnKey}
        className={clsx(
          'shrink-0 w-[4px] cursor-col-resize group relative flex items-center justify-center transition-colors',
          isResizing
            ? 'bg-brand-500/40'
            : 'bg-transparent hover:bg-brand-500/25 active:bg-brand-500/40',
        )}
        title={isResizing ? 'Soltar para aplicar tamaño' : 'Arrastrar para redimensionar · Flechas ← → para ajustar · Home/End min/max'}
      >
        <div
          aria-hidden="true"
          className={clsx(
            'absolute left-1/2 -translate-x-1/2 w-1 rounded-full transition-all',
            isResizing
              ? 'h-12 bg-brand-500 shadow'
              : 'h-8 bg-border/80 group-hover:bg-brand-500/70 group-focus-within:bg-brand-500/70'
          )}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 h-full">
        <div
          className="px-4 py-2 border-b border-border bg-surface/90 backdrop-blur space-y-2 shrink-0 z-[8]"
          data-docs-toolbar
        >
          <nav
            aria-label="Ruta de navegación"
            className="flex items-center gap-1 text-[11px] text-muted-foreground flex-wrap min-w-0"
          >
            <button
              className={clsx(
                'px-1.5 h-6 inline-flex items-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 min-w-[32px] justify-center',
                selectedFolderId == null
                  ? 'text-brand-700 dark:text-brand-300 bg-brand-500/12 font-semibold ring-1 ring-brand-500/25'
                  : 'hover:bg-surface-secondary text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setSelectedFolderId(null)}
              title="Ir a la raíz del proyecto"
            >
              Raíz
            </button>
            {breadcrumbChain.map((f, idx) => {
              const isLast = idx === breadcrumbChain.length - 1
              return (
                <span
                  key={f.id}
                  className="flex items-center gap-1 min-w-0"
                >
                  <ChevronRight className="w-3 h-3 shrink-0 opacity-50" aria-hidden="true" />
                  <button
                    className={clsx(
                      'px-1.5 h-6 inline-flex items-center rounded-md truncate max-w-[220px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60',
                      isLast
                        ? 'text-foreground font-bold bg-surface-secondary ring-1 ring-border shadow-sm'
                        : 'hover:bg-surface-secondary text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => setSelectedFolderId(f.id)}
                    title={`${isLast ? 'Carpeta actual: ' : 'Ir a: '}${f.name}`}
                  >
                    {f.name}
                  </button>
                </span>
              )
            })}
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              {(visibleFoldersCurrentLevel.length + (filesItems?.length ?? 0)) > 0 && (
                <span className="hidden sm:inline-flex items-center px-1.5 h-6 rounded-md bg-surface-secondary ring-1 ring-border text-[10.5px] tabular-nums text-muted-foreground font-medium">
                  {visibleFoldersCurrentLevel.length + (filesItems?.length ?? 0)} elementos
                </span>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="relative flex-1 min-w-[220px] max-w-[560px]">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="text"
                placeholder="Buscar en el proyecto..."
                value={docsSearchInput}
                onChange={(e) => setDocsSearchInput(e.target.value)}
                className="input-base pl-8 pr-2.5 text-[11.5px] w-full rounded-md border-border h-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
                aria-label="Buscar en proyecto"
                title="Buscar archivos y carpetas en el proyecto (búsqueda local)"
              />
            </div>
            <button
              className="btn-ghost p-1 rounded-md h-8 w-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 min-w-[32px]"
              aria-label="Destacar carpeta actual como favorito"
              title="Marcar carpeta actual como favorita"
            >
              <Star className="w-4 h-4 text-muted-foreground hover:text-amber-500 transition-colors" />
            </button>
            <button
              className="btn-secondary px-2.5 rounded-md text-[11.5px] h-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 min-w-[32px]"
              onClick={() => {
                setNewFolderName('')
                setNewFolderError('')
                setShowNewFolder(true)
              }}
              disabled={!project || createFolderMutationPending}
              title="Crear una nueva subcarpeta dentro de la ubicación actual"
            >
              {createFolderMutationPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">Creando…</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva carpeta</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto overflow-x-auto scrollbar-thin px-4 py-1 bg-surface-primary/20 min-h-0"
          onContextMenu={(e) => {
            const t = e.target as HTMLElement
            if (t.closest('thead') || t.closest('[data-docs-toolbar]')) return
            e.preventDefault()
            setFolderContextMenu(null)
            setFileContextMenu(null)
            setDocsAreaContextMenu({ x: e.clientX, y: e.clientY })
          }}
        >
          <table
            className="w-full text-[11.5px] min-w-[520px] border-separate border-spacing-0"
            role="table"
          >
            <thead className="bg-transparent">
              <tr className="text-left text-[10.5px] text-muted-foreground/80 border-b border-border/80">
                <th
                  scope="col"
                  className="py-1.5 pr-2 pl-1.5 font-semibold w-[32px] text-center sticky top-0 z-[5] bg-surface-secondary/90 backdrop-blur"
                >
                  <span className="opacity-40" aria-hidden="true">★</span>
                </th>
                <th
                  scope="col"
                  className="py-1.5 px-2 font-semibold sticky top-0 z-[5] bg-surface-secondary/90 backdrop-blur min-w-[240px]"
                >
                  Nombre
                </th>
                <th
                  scope="col"
                  className="py-1.5 px-2 font-semibold hidden sm:table-cell sticky top-0 z-[5] bg-surface-secondary/90 backdrop-blur w-[150px]"
                >
                  Propietario
                </th>
                <th
                  scope="col"
                  className="py-1.5 px-2 font-semibold hidden lg:table-cell sticky top-0 z-[5] bg-surface-secondary/90 backdrop-blur w-[150px]"
                >
                  Modificado
                </th>
                <th
                  scope="col"
                  className="py-1.5 px-2 font-semibold hidden md:table-cell sticky top-0 z-[5] bg-surface-secondary/90 backdrop-blur w-[90px]"
                >
                  Vers.
                </th>
                <th
                  scope="col"
                  className="py-1.5 px-2 font-semibold hidden md:table-cell text-right tabular-nums sticky top-0 z-[5] bg-surface-secondary/90 backdrop-blur w-[96px]"
                >
                  Tamaño
                </th>
              </tr>
            </thead>
            <tbody>
              {foldersAreLoading || filesIsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr
                    key={`skel-doc-${i}`}
                    className="border-b border-border/50 h-8"
                    aria-hidden="true"
                  >
                    <td className="py-0.5 pr-2 pl-1.5 w-[32px]" />
                    <td className="py-0.5 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-surface-secondary animate-pulse shrink-0 ring-1 ring-black/5" />
                        <div className="h-3 w-52 bg-surface-secondary rounded animate-pulse" />
                      </div>
                    </td>
                    <td className="py-0.5 px-2 hidden sm:table-cell">
                      <div className="h-2.5 w-24 bg-surface-secondary rounded animate-pulse" />
                    </td>
                    <td className="py-0.5 px-2 hidden lg:table-cell">
                      <div className="h-2.5 w-20 bg-surface-secondary rounded animate-pulse" />
                    </td>
                    <td className="py-0.5 px-2 hidden md:table-cell">
                      <div className="h-2.5 w-10 bg-surface-secondary rounded animate-pulse" />
                    </td>
                    <td className="py-0.5 px-2 hidden md:table-cell">
                      <div className="h-2.5 w-14 bg-surface-secondary rounded animate-pulse ml-auto" />
                    </td>
                  </tr>
                ))
              ) : visibleFoldersCurrentLevel.length === 0 &&
                (filesItems?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="py-10 text-center">
                      <div className="w-11 h-11 mx-auto rounded-xl bg-surface-secondary/80 ring-1 ring-black/5 flex items-center justify-center mb-2">
                        <FolderKanban className="w-5 h-5 text-muted-foreground/80" aria-hidden="true" />
                      </div>
                      <p className="font-semibold text-foreground text-[12.5px]">
                        {selectedFolderId == null ? 'Este proyecto está vacío' : 'Esta carpeta está vacía'}
                      </p>
                      <p className="text-muted-foreground text-[11px] mt-1 max-w-md mx-auto leading-relaxed">
                        {selectedFolderId == null
                          ? 'Sube un archivo o crea una carpeta para empezar a organizar el conocimiento.'
                          : 'Sube un archivo o crea una subcarpeta para empezar a organizar este espacio.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {visibleFoldersCurrentLevel.map((f) => {
                    const selected =
                      selectedType === 'folder' && selectedId === f.id
                    return (
                      <tr
                        key={`folder-${f.id}`}
                        onClick={() => {
                          setSelectedResource({ type: 'folder', id: f.id, projectId })
                        }}
                        onDoubleClick={() => {
                          setSelectedFolderId(f.id)
                          setSelectedResource({ type: 'folder', id: f.id, projectId })
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setSelectedResource({ type: 'folder', id: f.id, projectId })
                          setFolderContextMenu({
                            folder: f,
                            x: e.clientX,
                            y: e.clientY,
                          })
                        }}
                        className={clsx(
                          'border-b border-border/45 cursor-pointer group transition-all h-8',
                          selected
                            ? 'bg-brand-500/12 hover:bg-brand-500/16'
                            : 'hover:bg-surface-secondary/60'
                        )}
                        style={
                          selected
                            ? { boxShadow: 'inset 2px 0 0 0 rgb(var(--brand-500, 37 99 235))' }
                            : undefined
                        }
                        aria-selected={selected}
                        role="row"
                        tabIndex={0}
                      >
                        <td className="py-0.5 pr-2 pl-1.5 w-[32px] align-middle text-center">
                          <button
                            className={clsx(
                              'opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:text-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/50 rounded h-6 w-6 inline-flex items-center justify-center',
                              isLocalFavorite('FOLDER', f.id) ?? false
                                ? 'text-amber-500 opacity-100'
                                : 'text-muted-foreground'
                            )}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleFavorite('FOLDER', f.id)
                            }}
                            aria-label="Marcar carpeta como favorita"
                            tabIndex={0}
                          >
                            <Star
                              className={clsx(
                                'w-3.5 h-3.5',
                                (isLocalFavorite('FOLDER', f.id) ?? false) && 'fill-current'
                              )}
                            />
                          </button>
                        </td>
                        <td className="py-0.5 px-2 align-middle">
                          <div className="flex items-center gap-2 min-w-0 h-6" title={f.name}>
                            <div
                              className={clsx(
                                'w-7 h-7 rounded-md flex items-center justify-center shrink-0 ring-1 ring-black/5 shadow-sm',
                                selected
                                  ? 'bg-amber-200/90 dark:bg-amber-400/25'
                                  : 'bg-amber-100/80 dark:bg-amber-500/15'
                              )}
                              aria-hidden="true"
                            >
                              <Folder className={clsx(
                                'w-4 h-4',
                                selected
                                  ? 'text-amber-700 dark:text-amber-300'
                                  : 'text-amber-600 dark:text-amber-400'
                              )} />
                            </div>
                            <span
                              className={clsx(
                                'truncate font-semibold text-[12px] transition-colors',
                                selected
                                  ? 'text-brand-800 dark:text-brand-200'
                                  : 'text-foreground'
                              )}
                            >
                              {f.name}
                            </span>
                            {project?.docMaestroCarpetaId?.toLowerCase() === f.id.toLowerCase() && (
                              <span className="ml-auto shrink-0 inline-flex items-center gap-0.5 text-[9.5px] font-semibold leading-none px-1 py-0.5 rounded-full bg-brand-500/15 text-brand-700 dark:text-brand-200 ring-1 ring-black/5" title="Documento maestro del proyecto">
                                <FileCheck2 className="w-3 h-3" />
                                <span className="hidden sm:inline">Maestro</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-0.5 px-2 text-muted-foreground hidden sm:table-cell align-middle">
                          <span className="inline-flex items-center gap-1.5 text-[11px]">
                            <FolderKanban className="w-3 h-3 opacity-60" />
                            <span className="truncate">Carpeta</span>
                          </span>
                        </td>
                        <td className="py-0.5 px-2 text-muted-foreground hidden lg:table-cell align-middle tabular-nums">
                          {formatRelativeTime(f.updatedAt ?? f.createdAt)}
                        </td>
                        <td className="py-0.5 px-2 text-muted-foreground/70 hidden md:table-cell align-middle">
                          <span className="text-[10.5px] tracking-wide">—</span>
                        </td>
                        <td className="py-0.5 px-2 text-muted-foreground hidden md:table-cell text-right tabular-nums align-middle">
                          <span className="inline-flex items-center rounded-md bg-surface-secondary/60 ring-1 ring-border/70 px-1.5 h-6 text-[10.5px] font-medium">
                            {f.filesCount + f.childrenCount} items
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {filesItems?.map((file: ApiFile) => {
                    const selected =
                      selectedType === 'file' && selectedId === file.id
                    const badgeVersion =
                      file.s3VersionId && file.s3VersionId.length > 0
                        ? (file.s3VersionId.length <= 6 ? file.s3VersionId : `${file.s3VersionId.slice(0, 6)}…`)
                        : null
                    return (
                      <tr
                        key={`file-${file.id}`}
                        onClick={() =>
                          setSelectedResource({ type: 'file', id: file.id, projectId })
                        }
                        onDoubleClick={() => {
                          setSelectedResource({ type: 'file', id: file.id, projectId })
                          if (file.downloadUrl) {
                            window.open(file.downloadUrl, '_blank', 'noopener,noreferrer')
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setSelectedResource({ type: 'file', id: file.id, projectId })
                          setFileContextMenu({
                            file,
                            x: e.clientX,
                            y: e.clientY,
                          })
                        }}
                        className={clsx(
                          'border-b border-border/45 cursor-pointer group transition-all h-8',
                          selected
                            ? 'bg-brand-500/12 hover:bg-brand-500/16'
                            : 'hover:bg-surface-secondary/60'
                        )}
                        style={
                          selected
                            ? { boxShadow: 'inset 2px 0 0 0 rgb(var(--brand-500, 37 99 235))' }
                            : undefined
                        }
                        aria-selected={selected}
                        role="row"
                        tabIndex={0}
                      >
                        <td className="py-0.5 pr-2 pl-1.5 w-[32px] align-middle text-center">
                          <button
                            className={clsx(
                              'opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:text-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/50 rounded h-6 w-6 inline-flex items-center justify-center',
                              isLocalFavorite('FILE', file.id) ?? false
                                ? 'text-amber-500 opacity-100'
                                : 'text-muted-foreground'
                            )}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleFavorite('FILE', file.id)
                            }}
                            aria-label="Marcar archivo como favorita"
                            tabIndex={0}
                          >
                            <Star
                              className={clsx(
                                'w-3.5 h-3.5',
                                (isLocalFavorite('FILE', file.id) ?? false) && 'fill-current'
                              )}
                            />
                          </button>
                        </td>
                        <td className="py-0.5 px-2 align-middle">
                          <div className="flex items-center gap-2 min-w-0 h-6" title={file.name}>
                            <div
                              className={clsx(
                                'w-7 h-7 rounded-md flex items-center justify-center shrink-0 ring-1 ring-black/5 shadow-sm',
                                colorForKind(fileKind(file)),
                                selected && 'brightness-95'
                              )}
                              aria-hidden="true"
                            >
                              {(() => {
                                const Ic = iconForKind(fileKind(file))
                                return <Ic className="w-4 h-4 text-white/95" />
                              })()}
                            </div>
                            <span
                              className={clsx(
                                'truncate font-medium transition-colors',
                                file.downloadUrl
                                  ? selected
                                    ? 'text-brand-700 dark:text-brand-300 underline decoration-brand-500/40 underline-offset-2'
                                    : 'text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-300'
                                  : 'text-foreground'
                              )}
                            >
                              {file.name}
                            </span>
                            {project?.docMaestroArchivoId?.toLowerCase() === file.id.toLowerCase() && (
                              <span className="ml-auto shrink-0 inline-flex items-center gap-0.5 text-[9.5px] font-semibold leading-none px-1 py-0.5 rounded-full bg-brand-500/15 text-brand-700 dark:text-brand-200 ring-1 ring-black/5" title="Documento maestro del proyecto">
                                <FileCheck2 className="w-3 h-3" />
                                <span className="hidden sm:inline">Maestro</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-0.5 px-2 text-muted-foreground hidden sm:table-cell align-middle">
                          <span
                            className="truncate inline-flex items-center min-w-0"
                            title={file.ownerName || file.ownerEmail || undefined}
                          >
                            {file.ownerName || file.ownerEmail || '—'}
                          </span>
                        </td>
                        <td className="py-0.5 px-2 text-muted-foreground hidden lg:table-cell align-middle tabular-nums">
                          {formatRelativeTime(file.updatedAt ?? file.createdAt)}
                        </td>
                        <td className="py-0.5 px-2 text-muted-foreground/80 hidden md:table-cell align-middle" title={file.s3VersionId ? `Versión S3: ${file.s3VersionId}` : 'Versión inicial'}>
                          {badgeVersion ? (
                            <span className="inline-flex items-center rounded-md bg-brand-500/10 text-brand-700 dark:text-brand-300 ring-1 ring-brand-500/30 px-1.5 h-6 text-[10px] font-semibold tabular-nums tracking-tight">
                              {badgeVersion}
                            </span>
                          ) : (
                            <span className="text-[10.5px] opacity-50 tracking-wide">—</span>
                          )}
                        </td>
                        <td className="py-0.5 px-2 text-muted-foreground hidden md:table-cell text-right tabular-nums align-middle">
                          <span className="tabular-nums">{formatBytes(file.sizeBytes)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
