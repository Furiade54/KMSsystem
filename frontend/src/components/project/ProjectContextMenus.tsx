import React from 'react'
import {
  FolderOpen, Edit3, ArrowRightLeft, Star, XCircle, Loader2,
  FileCheck2, Trash2, FileText, MessageCircle, FolderPlus, Upload, ShieldAlert,
} from 'lucide-react'
import clsx from 'clsx'
import type { ApiFolder } from '@/services/folders.service'
import type { ApiFile } from '@/services/files.service'

export type CtxClampEntry = { left?: number; top?: number; maxH?: number } | null
export type CtxClamp = { folder?: CtxClampEntry; file?: CtxClampEntry }

/* ===== FOLDER CONTEXT MENU ====================================== */
export type FolderContextMenuState = {
  x: number
  y: number
  folder: ApiFolder
} | null

export type FolderContextMenuProps = {
  menu: FolderContextMenuState
  folderCtxRef: React.MutableRefObject<HTMLDivElement | null>
  clamp: CtxClamp
  canAdminMaster: boolean
  canEditFiles: boolean
  canDeleteFiles: boolean
  project: unknown | null | undefined
  isMasterFolder: boolean
  onClose: () => void
  onOpen: (folderId: string) => void
  onRename: (folder: ApiFolder) => void
  onMoveCopy: (folder: ApiFolder) => void
  onToggleFavorite: (folderId: string) => void
  isLocalFavorite: (type: 'FOLDER' | 'FILE', id: string) => boolean | null | undefined
  onClearMaster: () => void
  onDesignateMasterFolder: (folderId: string) => void
  onDelete: (folder: ApiFolder) => void
  designatePending: boolean
  clearPending: boolean
  deletePending: boolean
  deletingId: string | undefined
}

export function FolderContextMenu(props: FolderContextMenuProps) {
  const {
    menu, folderCtxRef, clamp,
    canAdminMaster, canEditFiles, canDeleteFiles, project, isMasterFolder, onClose,
    onOpen, onRename, onMoveCopy, onToggleFavorite, isLocalFavorite,
    onClearMaster, onDesignateMasterFolder, onDelete,
    designatePending, clearPending, deletePending, deletingId,
  } = props
  if (!menu) return null
  const f = menu.folder
  const favorite = (isLocalFavorite('FOLDER', f.id) ?? false)
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        ref={folderCtxRef}
        className="fixed z-50 w-52 card p-1 text-sm shadow-2xl overflow-y-auto"
        style={{
          left: clamp.folder?.left ?? menu.x,
          top: clamp.folder?.top ?? menu.y,
          maxHeight: clamp.folder?.maxH ? `${clamp.folder.maxH}px` : undefined,
        }}
      >
        <button
          onClick={() => {
            onClose()
            onOpen(f.id)
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground"
        >
          <FolderOpen className="w-4 h-4" />
          Abrir
        </button>
        <button
          onClick={() => {
            onClose()
            onRename(f)
          }}
          disabled={!canEditFiles}
          title={canEditFiles ? undefined : 'No tienes permiso para renombrar esta carpeta'}
          className={clsx(
            'w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground',
            !canEditFiles && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Edit3 className="w-4 h-4" />
          Renombrar
        </button>
        <button
          onClick={() => {
            onClose()
            onMoveCopy(f)
          }}
          disabled={!canEditFiles}
          title={canEditFiles ? undefined : 'No tienes permiso para mover o copiar esta carpeta'}
          className={clsx(
            'w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground',
            !canEditFiles && 'opacity-50 cursor-not-allowed'
          )}
        >
          <ArrowRightLeft className="w-4 h-4" />
          Mover / Copiar
        </button>
        <button
          onClick={() => {
            onClose()
            onToggleFavorite(f.id)
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground"
        >
          <Star
            className={clsx('w-4 h-4', favorite && 'fill-current text-amber-500')}
          />
          {favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
        </button>
        {canAdminMaster && (() => {
          void project
          return (
            <>
              <div className="my-1 border-t border-border/60" />
              {isMasterFolder ? (
                <button
                  onClick={() => {
                    onClose()
                    onClearMaster()
                  }}
                  disabled={clearPending}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-status-blocked/10 text-status-blocked disabled:opacity-50"
                >
                  {clearPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Quitar de documento maestro
                </button>
              ) : (
                <button
                  onClick={() => {
                    onClose()
                    onDesignateMasterFolder(f.id)
                  }}
                  disabled={designatePending}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground disabled:opacity-50"
                >
                  {designatePending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileCheck2 className="w-4 h-4 text-brand-500" />
                  )}
                  Designar como maestro
                </button>
              )}
            </>
          )
        })()}
        <div className="my-1 border-t border-border/60" />
        <button
          onClick={() => {
            onClose()
            if (!canDeleteFiles) return
            onDelete(f)
          }}
          disabled={deletePending || !canDeleteFiles}
          title={canDeleteFiles ? undefined : 'No tienes permiso para eliminar esta carpeta'}
          className={clsx(
            'w-full flex items-center gap-2 px-3 py-2 rounded-md text-status-blocked disabled:opacity-50',
            canDeleteFiles ? 'hover:bg-status-blocked/15' : 'cursor-not-allowed'
          )}
        >
          {deletingId === f.id && deletePending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Eliminando…
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4" />
              Eliminar
            </>
          )}
        </button>
      </div>
    </>
  )
}

/* ===== FILE CONTEXT MENU ====================================== */
export type FileContextMenuState = {
  x: number
  y: number
  file: ApiFile
} | null

export type FileContextMenuProps = {
  menu: FileContextMenuState
  fileCtxRef: React.MutableRefObject<HTMLDivElement | null>
  clamp: CtxClamp
  canAdminMaster: boolean
  canEditFiles: boolean
  canDeleteFiles: boolean
  project: unknown | null | undefined
  isMasterFile: boolean
  onClose: () => void
  onOpenDownload: (file: ApiFile) => void
  onRename: (file: ApiFile) => void
  onMoveCopy: (file: ApiFile) => void
  onComment: (file: ApiFile) => void
  onToggleFavorite: (fileId: string) => void
  isLocalFavorite: (type: 'FOLDER' | 'FILE', id: string) => boolean | null | undefined
  onClearMaster: () => void
  onDesignateMasterFile: (fileId: string) => void
  onDelete: (file: ApiFile) => void
  designatePending: boolean
  clearPending: boolean
  deletePending: boolean
  deletingId: string | undefined
  authUserId?: string | null
  projectOwnerId?: string | null
}

export function FileContextMenu(props: FileContextMenuProps) {
  const {
    menu, fileCtxRef, clamp,
    canAdminMaster, canEditFiles, canDeleteFiles, project, isMasterFile, onClose,
    onOpenDownload, onRename, onMoveCopy, onComment,
    onToggleFavorite, isLocalFavorite,
    onClearMaster, onDesignateMasterFile, onDelete,
    designatePending, clearPending, deletePending, deletingId,
    authUserId = null, projectOwnerId = null,
  } = props
  if (!menu) return null
  const f = menu.file
  const favorite = (isLocalFavorite('FILE', f.id) ?? false)

  const isFileOwner = !!(authUserId && f.ownerId && String(f.ownerId).toLowerCase() === String(authUserId).toLowerCase())
  const isProjectOwner = !!(authUserId && projectOwnerId && String(projectOwnerId).toLowerCase() === String(authUserId).toLowerCase())
  const canDeleteFile = isFileOwner || isProjectOwner || canDeleteFiles
  const deleteDisabledHint = canDeleteFile
    ? undefined
    : 'Solo el propietario del archivo, propietario del proyecto o usuarios con permiso de eliminación pueden borrarlo.'

  void project
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        ref={fileCtxRef}
        className="fixed z-50 w-52 card p-1 text-sm shadow-2xl overflow-y-auto"
        style={{
          left: clamp.file?.left ?? menu.x,
          top: clamp.file?.top ?? menu.y,
          maxHeight: clamp.file?.maxH ? `${clamp.file.maxH}px` : undefined,
        }}
      >
        <button
          onClick={() => {
            onClose()
            onOpenDownload(f)
          }}
          disabled={!f.downloadUrl}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground disabled:opacity-50"
        >
          <FileText className="w-4 h-4" />
          Abrir / Descargar
        </button>
        <button
          onClick={() => {
            onClose()
            onRename(f)
          }}
          disabled={!canEditFiles}
          title={canEditFiles ? undefined : 'No tienes permiso para renombrar este archivo'}
          className={clsx(
            'w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground',
            !canEditFiles && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Edit3 className="w-4 h-4" />
          Renombrar
        </button>
        <button
          onClick={() => {
            onClose()
            onMoveCopy(f)
          }}
          disabled={!canEditFiles}
          title={canEditFiles ? undefined : 'No tienes permiso para mover o copiar este archivo'}
          className={clsx(
            'w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground',
            !canEditFiles && 'opacity-50 cursor-not-allowed'
          )}
        >
          <ArrowRightLeft className="w-4 h-4" />
          Mover / Copiar
        </button>
        <button
          onClick={() => {
            onClose()
            onComment(f)
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground"
        >
          <MessageCircle className="w-4 h-4" />
          Comentar
        </button>
        <button
          onClick={() => {
            onClose()
            onToggleFavorite(f.id)
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground"
        >
          <Star
            className={clsx('w-4 h-4', favorite && 'fill-current text-amber-500')}
          />
          {favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
        </button>
        {canAdminMaster && (() => {
          void project
          return (
            <>
              <div className="my-1 border-t border-border/60" />
              {isMasterFile ? (
                <button
                  onClick={() => {
                    onClose()
                    onClearMaster()
                  }}
                  disabled={clearPending}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-status-blocked/10 text-status-blocked disabled:opacity-50"
                >
                  {clearPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Quitar de documento maestro
                </button>
              ) : (
                <button
                  onClick={() => {
                    onClose()
                    onDesignateMasterFile(f.id)
                  }}
                  disabled={designatePending}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground disabled:opacity-50"
                >
                  {designatePending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileCheck2 className="w-4 h-4 text-brand-500" />
                  )}
                  Designar como maestro
                </button>
              )}
            </>
          )
        })()}
        <div className="my-1 border-t border-border/60" />
        <button
          onClick={() => {
            onClose()
            if (!canDeleteFile) return
            onDelete(f)
          }}
          disabled={deletePending || !canDeleteFile}
          title={!canDeleteFile ? deleteDisabledHint : undefined}
          className={clsx(
            'w-full flex items-center gap-2 px-3 py-2 rounded-md text-status-blocked disabled:opacity-50',
            canDeleteFile ? 'hover:bg-status-blocked/15' : 'cursor-not-allowed'
          )}
        >
          {deletingId === f.id && deletePending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Eliminando…
            </>
          ) : !canDeleteFile ? (
            <>
              <ShieldAlert className="w-4 h-4 opacity-70" />
              Sin permiso para eliminar
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4" />
              Eliminar
            </>
          )}
        </button>
      </div>
    </>
  )
}

/* ===== DOCSAREA CONTEXT MENU ====================================== */
export type DocsAreaContextMenuState = {
  x: number
  y: number
} | null

export type DocsAreaContextMenuProps = {
  menu: DocsAreaContextMenuState
  project: unknown | null | undefined
  createPending: boolean
  isUploading: boolean
  uploadPending: boolean
  canCreateFolder: boolean
  canUploadFile: boolean
  onClose: () => void
  onCreateFolder: () => void
  onUploadFile: () => void
}

export function DocsAreaContextMenu(props: DocsAreaContextMenuProps) {
  const { menu, project, createPending, isUploading, uploadPending, canCreateFolder, canUploadFile, onClose, onCreateFolder, onUploadFile } = props
  if (!menu) return null
  const MENU_W = 220
  const MENU_H = 108
  const x = Math.min(Math.max(4, menu.x), typeof window !== 'undefined' ? window.innerWidth - MENU_W - 4 : menu.x)
  const y = Math.min(Math.max(4, menu.y), typeof window !== 'undefined' ? window.innerHeight - MENU_H - 4 : menu.y)
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        className="fixed z-50 w-56 card p-1 text-sm shadow-2xl"
        style={{ left: x, top: y }}
      >
        <button
          onClick={() => {
            onClose()
            onCreateFolder()
          }}
          disabled={!project || createPending || !canCreateFolder}
          title={canCreateFolder ? undefined : 'No tienes permiso para crear carpetas en este proyecto'}
          className={clsx(
            'w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground disabled:opacity-50',
            !canCreateFolder && 'cursor-not-allowed'
          )}
        >
          <FolderPlus className="w-4 h-4" />
          Crear carpeta
        </button>
        <button
          onClick={() => {
            onClose()
            onUploadFile()
          }}
          disabled={isUploading || uploadPending || !canUploadFile}
          title={canUploadFile ? undefined : 'No tienes permiso para subir archivos en este proyecto'}
          className={clsx(
            'w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground disabled:opacity-50',
            !canUploadFile && 'cursor-not-allowed'
          )}
        >
          <Upload className="w-4 h-4" />
          Subir archivo
        </button>
      </div>
    </>
  )
}
