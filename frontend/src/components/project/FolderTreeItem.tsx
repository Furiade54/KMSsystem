import { useState } from 'react'
import clsx from 'clsx'
import type { FolderNode } from '@/services/folders.service'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Check,
  FileCheck2,
} from 'lucide-react'

export function MasterFolderTreeItem({
  node,
  depth,
  selectedFolderId,
  onSelect,
}: {
  node: FolderNode
  depth: number
  selectedFolderId: string | null
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const hasChildren = node.children && node.children.length > 0
  const sel = selectedFolderId === node.id
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={clsx(
          'w-full flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-left transition-colors',
          sel ? 'bg-brand-600/15 ring-1 ring-brand-500/60 text-foreground' : 'text-foreground hover:bg-surface-secondary'
        )}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setOpen((v) => !v)
            }}
            className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 shrink-0 -ml-1"
            aria-label={open ? 'Colapsar' : 'Expandir'}
          >
            {open ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-[18px] shrink-0" aria-hidden="true" />
        )}
        {open && hasChildren ? (
          <FolderOpen className="w-4 h-4 text-status-review shrink-0" />
        ) : (
          <Folder className="w-4 h-4 text-status-review shrink-0" />
        )}
        <span className="truncate flex-1 min-w-0">{node.name}</span>
        {sel && (
          <Check className="w-4 h-4 ml-1 text-brand-600 dark:text-brand-300 shrink-0" />
        )}
      </button>
      {open && hasChildren
        ? node.children.map((c) => (
            <MasterFolderTreeItem
              key={c.id}
              node={c}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  )
}

export function FolderTreeItem({
  node,
  depth,
  selectedFolderId,
  onSelect,
  onContextMenu,
  docMaestroCarpetaId,
}: {
  node: FolderNode
  depth: number
  selectedFolderId: string | null
  onSelect: (node: FolderNode) => void
  onContextMenu?: (e: React.MouseEvent, node: FolderNode) => void
  docMaestroCarpetaId?: string | null
}) {
  const [open, setOpen] = useState(depth === 0)
  const hasChildren = node.children.length > 0
  const isSelected = selectedFolderId === node.id
  const isDocMaster =
    docMaestroCarpetaId != null &&
    String(node.id).toLowerCase() === String(docMaestroCarpetaId).toLowerCase()
  const padLeft = 8 + depth * 14
  return (
    <div className="relative">
      {depth > 0 && (
        <span
          aria-hidden="true"
          className="absolute left-[17px] top-0 bottom-0 w-px bg-border/70 pointer-events-none"
        />
      )}
      <button
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? open : undefined}
        onClick={() => {
          onSelect(node)
          if (hasChildren) setOpen((v) => !v)
        }}
        onContextMenu={(e) => {
          if (onContextMenu) onContextMenu(e, node)
        }}
        className={clsx(
          'relative w-full flex items-center gap-1.5 px-1.5 rounded-md text-[11.5px] text-left transition-all h-8 group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60',
          isSelected
            ? 'bg-brand-500/18 text-brand-800 dark:text-brand-200 ring-1 ring-brand-500/40 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]'
            : 'text-foreground hover:bg-surface-secondary/80'
        )}
        style={{ paddingLeft: `${padLeft}px` }}
        title={node.name}
      >
        <span
          onClick={(e) => {
            if (!hasChildren) return
            e.stopPropagation()
            setOpen((v) => !v)
          }}
          role={hasChildren ? 'button' : undefined}
          tabIndex={hasChildren ? 0 : -1}
          aria-label={hasChildren ? (open ? 'Colapsar carpeta' : 'Expandir carpeta') : undefined}
          className={clsx(
            'w-4 h-4 shrink-0 flex items-center justify-center rounded transition-colors',
            hasChildren &&
              'cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brand-500/60 focus:outline-none'
          )}
          onKeyDown={(e) => {
            if (!hasChildren) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOpen((v) => !v)
            }
          }}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown
                className={clsx(
                  'w-3.5 h-3.5 shrink-0 transition-transform',
                  isSelected ? 'text-brand-600 dark:text-brand-300' : 'text-brand-500'
                )}
              />
            ) : (
              <ChevronRight
                className={clsx(
                  'w-3.5 h-3.5 shrink-0 transition-transform',
                  isSelected
                    ? 'text-brand-600/90 dark:text-brand-300'
                    : 'text-muted-foreground group-hover:text-brand-500'
                )}
              />
            )
          ) : (
            <span className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          )}
        </span>
        <Folder
          className={clsx(
            'w-3.5 h-3.5 shrink-0 transition-colors',
            isSelected
              ? 'text-amber-600 dark:text-amber-300'
              : 'text-amber-500/90 dark:text-amber-400 group-hover:text-amber-600 dark:group-hover:text-amber-300'
          )}
        />
        <span className="truncate font-medium min-w-0">{node.name}</span>
        {isDocMaster && (
          <span
            className="ml-auto mr-1 inline-flex items-center gap-0.5 text-[9.5px] font-semibold leading-none px-1 py-0.5 rounded-full bg-brand-500/15 text-brand-700 dark:text-brand-200 ring-1 ring-black/5"
            title="Documento maestro del proyecto"
          >
            <FileCheck2 className="w-3 h-3" />
            <span className="hidden sm:inline">Maestro</span>
          </span>
        )}
      </button>
      {open &&
        node.children.map((child) => (
          <FolderTreeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedFolderId={selectedFolderId}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
            docMaestroCarpetaId={docMaestroCarpetaId ?? null}
          />
        ))}
    </div>
  )
}

export function TransferTargetTreeItem({
  node,
  depth,
  disabledFolderIds,
  selectedTargetFolderId,
  onSelect,
}: {
  node: FolderNode
  depth: number
  disabledFolderIds: Set<string>
  selectedTargetFolderId: string | null
  onSelect: (folderId: string) => void
}) {
  const hasChildren = node.children.length > 0
  const [open, setOpen] = useState(depth === 0)
  const isDisabled = disabledFolderIds.has(node.id)
  const isSelected = selectedTargetFolderId === node.id
  return (
    <>
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => {
          if (isDisabled) return
          onSelect(node.id)
        }}
        title={isDisabled ? 'No se puede mover/copiar dentro de su propio subárbol' : node.name}
        className={clsx(
          'w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors',
          isSelected
            ? 'bg-brand-600/15 ring-1 ring-brand-500/60 text-foreground'
            : 'text-foreground hover:bg-surface-secondary',
          isDisabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
        )}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
      >
        {hasChildren ? (
          <ChevronRight
            onClick={(e) => {
              e.stopPropagation()
              setOpen((v) => !v)
            }}
            className={clsx(
              'w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-90',
              isDisabled && 'opacity-40'
            )}
          />
        ) : (
          <span className="w-[14px] shrink-0" aria-hidden />
        )}
        <Folder className="w-4 h-4 shrink-0 text-status-review" />
        <span className="truncate flex-1">{node.name}</span>
        {isSelected && (
          <Check className="w-4 h-4 shrink-0 text-brand-600 dark:text-brand-300" />
        )}
      </button>
      {open && hasChildren
        ? node.children.map((c) => (
            <TransferTargetTreeItem
              key={c.id}
              node={c}
              depth={depth + 1}
              disabledFolderIds={disabledFolderIds}
              selectedTargetFolderId={selectedTargetFolderId}
              onSelect={onSelect}
            />
          ))
        : null}
    </>
  )
}
