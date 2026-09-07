import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  FolderKanban,
  FileText,
  MessageSquare,
  Calendar,
  Users,
  Compass,
  FileCheck2,
  Clock,
  ChevronRight,
  ChevronDown,
  Plus,
  Folder,
  FolderOpen,
  File,
  Film,
  Music,
  Link2,
  Star,
  MoreHorizontal,
  Search,
  Trash2,
  Edit3,
  X,
  Check,
  Loader2,
  Upload,
  Image as ImageIcon,
  FileSpreadsheet,
  Presentation,
  FileArchive,
  Copy,
  ArrowRightLeft,
  FolderPlus,
  MessageCircle,
  Send,
  ShieldAlert,
  UserPlus,
  UserMinus,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { useUIStore } from '@/store/uiStore'
import type { SelectedResourceType } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import {
  ApiProjectStatus,
  deleteProject,
  formatRelativeTime,
  getProjectById,
  getProjectMembers,
  PaginatedData,
  projectGradientClass,
  statusBadgeInfo,
  updateProject,
  addProjectMember,
  removeProjectMember,
  updateProjectMemberRole,
  fetchOrganizationMembers,
  designateProjectMaster,
  clearProjectMaster,
  type OrgMember,
  type ProjectMember,
  type ProjectMasterDocInfo,
  type DesignateMasterDocPayload,
} from '../services/projects.service'
import {
  type FavoriteState,
  addFavorite,
  removeFavorite,
  toggleFavorite,
  listFavorites,
  type FavoriteResourceType,
  type FavoriteItem,
} from '../services/favorites.service'
import {
  ApiFolder,
  buildFolderTree,
  copyFolder,
  createFolder,
  deleteFolder,
  fetchFolders,
  FolderNode,
  moveFolder,
  updateFolder,
} from '../services/folders.service'
import {
  ApiFile,
  ApiFileType,
  commentFile as apiCommentFile,
  copyFile,
  deleteFile,
  fetchFiles,
  fileKind,
  formatBytes,
  moveFile,
  updateFile,
  uploadFile,
} from '../services/files.service'

const tabs = [
  { id: 'docs', label: 'Documentos', icon: FileText },
  { id: 'topics', label: 'Temas', icon: MessageSquare },
  { id: 'meetings', label: 'Reuniones', icon: Calendar },
  { id: 'contributions', label: 'Aportes', icon: Compass },
  { id: 'master', label: 'Documento maestro', icon: FileCheck2 },
  { id: 'activity', label: 'Actividad', icon: Clock },
  { id: 'team', label: 'Equipo', icon: Users },
]

const iconForKind = (k: ApiFileType) => {
  switch (k) {
    case 'folder':
      return Folder
    case 'video':
      return Film
    case 'audio':
      return Music
    case 'link':
      return Link2
    case 'image':
      return ImageIcon
    case 'pdf':
      return FileText
    case 'doc':
      return FileText
    case 'sheet':
      return FileSpreadsheet
    case 'slide':
      return Presentation
    case 'zip':
      return FileArchive
    default:
      return File
  }
}

const colorForKind = (k: ApiFileType) => {
  switch (k) {
    case 'folder':
      return 'text-status-review bg-status-review/20'
    case 'video':
      return 'text-pink-400 bg-pink-400/20'
    case 'audio':
      return 'text-purple-400 bg-purple-400/20'
    case 'link':
      return 'text-brand-400 bg-brand-400/20'
    case 'image':
      return 'text-indigo-300 bg-indigo-400/20'
    case 'pdf':
      return 'text-rose-300 bg-rose-400/20'
    case 'doc':
      return 'text-brand-300 bg-brand-500/20'
    case 'sheet':
      return 'text-emerald-300 bg-emerald-400/20'
    case 'slide':
      return 'text-amber-300 bg-amber-400/20'
    case 'zip':
      return 'text-orange-300 bg-orange-400/20'
    default:
      return 'text-gray-300 bg-surface-tertiary'
  }
}

function initials(fullName: string | null): string {
  if (!fullName) return '?'
  const parts = fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?'
}

function MasterFolderTreeItem({
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

function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const queryClient = useQueryClient()
  const { user: authUser } = useAuthStore()
  const { setSelectedResource, selectedResource, rightPanelOpen, toggleRightPanel } = useUIStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const renameFileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState('docs')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [docsSearchInput, setDocsSearchInput] = useState('')
  const [docsSearchDebounced, setDocsSearchDebounced] = useState('')
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [showDeleteProject, setShowDeleteProject] = useState(false)
  const [showForbiddenDelete, setShowForbiddenDelete] = useState(false)
  const [showEditProject, setShowEditProject] = useState(false)
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<ApiFile | null>(null)
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<ApiFolder | null>(null)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [folderContextMenu, setFolderContextMenu] = useState<{
    folder: ApiFolder
    x: number
    y: number
  } | null>(null)
  const [fileContextMenu, setFileContextMenu] = useState<{
    file: ApiFile
    x: number
    y: number
  } | null>(null)
  const [docsAreaContextMenu, setDocsAreaContextMenu] = useState<{ x: number; y: number } | null>(null)
  const folderCtxRef = useRef<HTMLDivElement | null>(null)
  const fileCtxRef = useRef<HTMLDivElement | null>(null)
  const [ctxClamp, setCtxClamp] = useState<{
    folder?: { left: number; top: number; maxH: number }
    file?: { left: number; top: number; maxH: number }
  }>({})
  const [treeWidth, setTreeWidth] = useState<number>(224)
  const [isResizing, setIsResizing] = useState(false)
  const [pageToast, setPageToast] = useState<{
    kind: 'error' | 'success'
    title: string
    message: string
  } | null>(null)
  const [showMasterSelector, setShowMasterSelector] = useState(false)
  const [masterSelectorTab, setMasterSelectorTab] = useState<'folders' | 'files'>('folders')
  const [masterSelectedFolderId, setMasterSelectedFolderId] = useState<string | null>(null)
  const [masterSelectedFileId, setMasterSelectedFileId] = useState<string | null>(null)
  const [showConfirmClearMaster, setShowConfirmClearMaster] = useState(false)
  const TREE_MIN_W = 180
  const TREE_MAX_W = 420

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      setIsResizing(true)
      const startX = e.clientX
      const startW = treeWidth
      const onMove = (_ev: PointerEvent) => {
        const delta = _ev.clientX - startX
        const next = Math.min(TREE_MAX_W, Math.max(TREE_MIN_W, startW + delta))
        setTreeWidth(next)
      }
      const onUp = (_ev: PointerEvent) => {
        ;(e.target as Element).releasePointerCapture?.(e.pointerId)
        setIsResizing(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [treeWidth]
  )

  const resizerOnKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setTreeWidth((w) => Math.max(TREE_MIN_W, w - 8))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setTreeWidth((w) => Math.min(TREE_MAX_W, w + 8))
      } else if (e.key === 'Home') {
        e.preventDefault()
        setTreeWidth(TREE_MIN_W)
      } else if (e.key === 'End') {
        e.preventDefault()
        setTreeWidth(TREE_MAX_W)
      }
    },
    []
  )

  const projectQuery = useQuery({
    queryKey: ['project', 'detail', projectId],
    queryFn: () => getProjectById(projectId),
    enabled: Boolean(projectId),
    staleTime: 60_000,
    retry: 1,
  })

  const membersQuery = useQuery({
    queryKey: ['project', 'members', projectId],
    queryFn: () => getProjectMembers(projectId),
    enabled: Boolean(projectId),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const foldersQuery = useQuery({
    queryKey: ['project', 'folders', projectId],
    queryFn: () => fetchFolders({ projectId, includeAll: true }),
    enabled: Boolean(projectId),
    staleTime: 60_000,
    retry: 1,
  })

  const folderTree = useMemo<FolderNode[]>(() => {
    if (!foldersQuery.data?.items) return []
    return buildFolderTree(foldersQuery.data.items)
  }, [foldersQuery.data])

  const flatFolderById = useMemo<Map<string, ApiFolder>>(() => {
    const m = new Map<string, ApiFolder>()
    foldersQuery.data?.items.forEach((f) => m.set(f.id, f))
    return m
  }, [foldersQuery.data])

  const filesQuery = useQuery<PaginatedData<ApiFile>>({
    queryKey: ['project', 'files', projectId, { folderId: selectedFolderId, search: docsSearchDebounced }],
    queryFn: () =>
      fetchFiles({
        projectId,
        folderId: selectedFolderId ?? undefined,
        search: docsSearchDebounced || undefined,
        pageSize: 100,
      }),
    enabled: Boolean(projectId),
    staleTime: 30_000,
    retry: 1,
  })

  useEffect(() => {
    const t = setTimeout(() => setDocsSearchDebounced(docsSearchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [docsSearchInput])

  useEffect(() => {
    if (!showEditProject) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowEditProject(false)
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [showEditProject])

  useEffect(() => {
    const fileQ = sp.get('file')
    const folderQ = sp.get('folder')
    let desired: { type: SelectedResourceType; id: string } | null = null
    if (fileQ) desired = { type: 'file', id: fileQ }
    else if (folderQ) desired = { type: 'folder', id: folderQ }
    if (!desired) return
    const already =
      selectedResource &&
      selectedResource.type === desired.type &&
      selectedResource.id === desired.id &&
      selectedResource.projectId === projectId
    if (already) {
      if (!rightPanelOpen) toggleRightPanel()
      return
    }
    setSelectedResource({ type: desired.type, id: desired.id, projectId })
    if (!rightPanelOpen) toggleRightPanel()
  }, [sp, projectId, selectedResource, rightPanelOpen, setSelectedResource, toggleRightPanel])

  const detail = projectQuery.data
  const project = detail?.project
  const stats = detail?.stats
  const headerBadge = project ? statusBadgeInfo(project.status) : null

  const visibleFoldersCurrentLevel = useMemo<ApiFolder[]>(() => {
    if (!foldersQuery.data?.items) return []
    return foldersQuery.data.items.filter((f) => {
      if (selectedFolderId == null) return f.parentId == null
      return f.parentId === selectedFolderId
    })
  }, [foldersQuery.data, selectedFolderId])

  const breadcrumbChain = useMemo<ApiFolder[]>(() => {
    if (selectedFolderId == null) return []
    const chain: ApiFolder[] = []
    let cur: ApiFolder | undefined = flatFolderById.get(selectedFolderId)
    const safety = new Set<string>()
    while (cur && !safety.has(cur.id)) {
      safety.add(cur.id)
      chain.unshift(cur)
      cur = cur.parentId ? flatFolderById.get(cur.parentId) : undefined
    }
    return chain
  }, [selectedFolderId, flatFolderById])

  const detailIsLoading = projectQuery.isLoading && projectQuery.fetchStatus !== 'idle'
  const detailIs404 = projectQuery.isError && (projectQuery.error as any)?.message?.toLowerCase().includes('no encontrado')

  if (!projectId) {
    return <Navigate to="/projects" replace />
  }

  if (detailIs404) {
    return <Navigate to="/projects" replace />
  }

  const invalidateDetail = () => {
    queryClient.invalidateQueries({ queryKey: ['project', 'detail', projectId] })
    queryClient.invalidateQueries({ queryKey: ['project', 'members', projectId] })
    queryClient.invalidateQueries({ queryKey: ['project', 'folders', projectId] })
    queryClient.invalidateQueries({ queryKey: ['project', 'files', projectId] })
    queryClient.invalidateQueries({ queryKey: ['projects'] })
  }

  const [editForm, setEditForm] = useState<{
    name: string
    description: string
    status: ApiProjectStatus
    errors: Record<string, string>
  }>({ name: '', description: '', status: 'ACTIVE', errors: {} })

  const openEditProject = () => {
    if (!project) return
    setEditForm({
      name: project.name,
      description: project.description || '',
      status: project.status,
      errors: {},
    })
    setShowEditProject(true)
  }

  const updateMutation = useMutation({
    mutationFn: (payload: { name?: string; description?: string; status?: ApiProjectStatus }) =>
      updateProject(projectId, payload),
    onSuccess: () => {
      invalidateDetail()
      setShowEditProject(false)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setEditForm((prev) => ({ ...prev, errors: { _global: msg } }))
    },
  })

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!project) return
    const errors: Record<string, string> = {}
    const name = editForm.name.trim()
    if (name.length === 0) errors.name = 'El nombre es obligatorio'
    else if (name.length > 200) errors.name = 'Máximo 200 caracteres'
    if (editForm.description.length > 2000) errors.description = 'Máximo 2000 caracteres'
    setEditForm((prev) => ({ ...prev, errors }))
    if (Object.keys(errors).length || updateMutation.isPending) return
    updateMutation.mutate({
      name,
      description: editForm.description.trim() || undefined,
      status: editForm.status,
    })
  }

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setShowDeleteProject(false)
      navigate('/projects', { replace: true })
    },
    onError: (err: any) => {
      if (err?.response?.status === 403) {
        setShowDeleteProject(false)
        setShowForbiddenDelete(true)
      } else {
        alert(err?.response?.data?.message || err?.message || 'No se pudo eliminar el proyecto')
      }
    },
  })

  const canManageMembers = useMemo(() => {
    if (!project?.ownerId) return false
    if (!authUser?.id) return false
    return String(project.ownerId).toLowerCase() === String(authUser.id).toLowerCase()
  }, [project, authUser])

  const canAdminMaster = useMemo(() => {
    if (!project?.ownerId || !authUser?.id) return false
    if (authUser.isOrgAdmin) return true
    return String(project.ownerId).toLowerCase() === String(authUser.id).toLowerCase()
  }, [project, authUser])

  const designateMasterMutation = useMutation({
    mutationFn: (payload: DesignateMasterDocPayload) => designateProjectMaster(projectId, payload),
    onSuccess: () => {
      invalidateDetail()
      setShowMasterSelector(false)
      setMasterSelectedFolderId(null)
      setMasterSelectedFileId(null)
      setPageToast({
        kind: 'success',
        title: 'Documento maestro actualizado',
        message: 'Se designó correctamente el nuevo documento o carpeta maestra del proyecto.',
      })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setPageToast({
        kind: 'error',
        title: 'No se pudo designar',
        message: msg,
      })
    },
  })

  const clearMasterMutation = useMutation({
    mutationFn: () => clearProjectMaster(projectId),
    onSuccess: () => {
      invalidateDetail()
      setShowConfirmClearMaster(false)
      setPageToast({
        kind: 'success',
        title: 'Documento maestro quitado',
        message: 'El proyecto ya no tiene un documento designado como maestro.',
      })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setPageToast({
        kind: 'error',
        title: 'No se pudo quitar',
        message: msg,
      })
    },
  })

  const handleMasterDesignateSubmit = () => {
    const rid = masterSelectorTab === 'folders' ? masterSelectedFolderId : masterSelectedFileId
    if (!rid) return
    const payload: DesignateMasterDocPayload = {
      resourceType: masterSelectorTab === 'folders' ? 'FOLDER' : 'FILE',
      resourceId: rid,
    }
    designateMasterMutation.mutate(payload)
  }

  const [showInviteMember, setShowInviteMember] = useState(false)
  const [inviteSearch, setInviteSearch] = useState('')
  const [inviteRole, setInviteRole] = useState('Miembro')
  const [inviteSelectedUserId, setInviteSelectedUserId] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState('')

  const orgMembersQuery = useQuery({
    queryKey: ['org', 'members', inviteSearch.trim()],
    queryFn: () => fetchOrganizationMembers({ search: inviteSearch.trim() || undefined, pageSize: 50 }),
    enabled: showInviteMember,
    staleTime: 30_000,
  })

  const candidateOrgMembers = useMemo<OrgMember[]>(() => {
    const already = new Set((membersQuery.data?.items ?? []).map((m) => String(m.userId).toLowerCase()))
    return (orgMembersQuery.data?.items ?? []).filter(
      (o) => !already.has(String(o.id).toLowerCase())
    )
  }, [orgMembersQuery.data, membersQuery.data])

  const addMemberMutation = useMutation({
    mutationFn: (payload: { userId: string; roleName?: string }) =>
      addProjectMember(projectId, payload.userId, payload.roleName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'members', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'detail', projectId] })
      setShowInviteMember(false)
      setInviteSelectedUserId(null)
      setInviteSearch('')
      setInviteError('')
    },
    onError: (err: unknown) => {
      setInviteError(err instanceof Error ? err.message : 'Error desconocido')
    },
  })

  const handleAddMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteSelectedUserId) {
      setInviteError('Selecciona un usuario de la organización')
      return
    }
    setInviteError('')
    addMemberMutation.mutate({ userId: inviteSelectedUserId, roleName: inviteRole.trim() || undefined })
  }

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => removeProjectMember(projectId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'members', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'detail', projectId] })
      setPageToast({
        kind: 'success',
        title: 'Miembro retirado',
        message: 'El usuario se retiró del proyecto y sus permisos específicos se revocaron.',
      })
    },
    onError: (err: any) => {
      setPageToast({
        kind: 'error',
        title: 'No se pudo retirar el miembro',
        message:
          err?.response?.data?.message ||
          err?.message ||
          'Error desconocido. Inténtalo de nuevo.',
      })
    },
  })

  const [confirmRemoveMember, setConfirmRemoveMember] = useState<ProjectMember | null>(null)

  const updateRoleMutation = useMutation({
    mutationFn: (payload: { memberId: string; roleName: string | null }) =>
      updateProjectMemberRole(projectId, payload.memberId, payload.roleName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'members', projectId] })
      setPageToast({
        kind: 'success',
        title: 'Rol actualizado',
        message: 'El rol del miembro en el proyecto se actualizó correctamente.',
      })
    },
    onError: (err: any) => {
      setPageToast({
        kind: 'error',
        title: 'No se pudo actualizar el rol',
        message:
          err?.response?.data?.message ||
          err?.message ||
          'Error desconocido. Inténtalo de nuevo.',
      })
    },
  })
  void updateRoleMutation

  const toggleFavoriteMutation = useMutation({
    mutationFn: (payload: { resourceType: FavoriteResourceType; resourceId: string }) =>
      toggleFavorite(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
      queryClient.invalidateQueries({ queryKey: ['favorite', 'check'] })
    },
    onError: (err: any) => {
      setPageToast({
        kind: 'error',
        title: 'No se pudo actualizar el favorito',
        message:
          err?.response?.data?.message ||
          err?.message ||
          'Error desconocido. Inténtalo de nuevo.',
      })
    },
  })

  const [favoriteLocals, setFavoriteLocals] = useState<Map<string, boolean>>(() => new Map<string, boolean>())

  function handleToggleFavorite(
    resourceType: FavoriteResourceType,
    resourceId: string,
    currentLocal?: boolean | undefined
  ) {
    const key = `${resourceType}:${resourceId}`
    const prev = currentLocal ?? favoriteLocals.get(key) ?? false
    setFavoriteLocals((draft) => {
      const d = new Map(draft)
      d.set(key, !prev)
      return d
    })
    toggleFavoriteMutation.mutate({ resourceType, resourceId }, {})
  }

  function isLocalFavorite(resourceType: FavoriteResourceType, resourceId: string) {
    const key = `${resourceType}:${resourceId}`
    const v = favoriteLocals?.get(key)
    return typeof v === 'boolean' ? v : undefined
  }

  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderError, setNewFolderError] = useState('')
  const createFolderMutation = useMutation({
    mutationFn: (name: string) =>
      createFolder({
        projectId,
        name: name.trim(),
        parentId: selectedFolderId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'folders', projectId] })
      setShowNewFolder(false)
      setNewFolderName('')
      setNewFolderError('')
    },
    onError: (err: unknown) => {
      setNewFolderError(err instanceof Error ? err.message : 'Error desconocido')
    },
  })

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault()
    const n = newFolderName.trim()
    if (n.length === 0 || n.length > 255) {
      setNewFolderError('Nombre de carpeta inválido (1..255 caracteres)')
      return
    }
    setNewFolderError('')
    createFolderMutation.mutate(n)
  }

  const [renameFolder, setRenameFolder] = useState<ApiFolder | null>(null)
  const [renameFolderName, setRenameFolderName] = useState('')
  const [renameFolderError, setRenameFolderError] = useState('')
  const renameFolderMutation = useMutation({
    mutationFn: (payload: { id: string; name: string }) =>
      updateFolder(payload.id, { name: payload.name.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'folders', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'files', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'detail', projectId] })
      setRenameFolder(null)
      setRenameFolderName('')
      setRenameFolderError('')
    },
    onError: (err: unknown) => {
      setRenameFolderError(err instanceof Error ? err.message : 'Error desconocido')
    },
  })

  const handleRenameFolder = (e: React.FormEvent) => {
    e.preventDefault()
    if (!renameFolder) return
    const n = renameFolderName.trim()
    if (n.length === 0 || n.length > 255) {
      setRenameFolderError('Nombre de carpeta inválido (1..255 caracteres)')
      return
    }
    setRenameFolderError('')
    renameFolderMutation.mutate({ id: renameFolder.id, name: n })
  }

  const [renameFile, setRenameFile] = useState<ApiFile | null>(null)
  const [renameFileName, setRenameFileName] = useState('')
  const [renameFileError, setRenameFileError] = useState('')
  const renameFileMutation = useMutation({
    mutationFn: (payload: { id: string; name: string }) =>
      updateFile(payload.id, { name: payload.name.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'folders', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'files', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'detail', projectId] })
      setRenameFile(null)
      setRenameFileName('')
      setRenameFileError('')
    },
    onError: (err: unknown) => {
      setRenameFileError(err instanceof Error ? err.message : 'Error desconocido')
    },
  })

  const handleRenameFile = (e: React.FormEvent) => {
    e.preventDefault()
    if (!renameFile) return
    const n = renameFileName.trim()
    if (n.length === 0 || n.length > 255) {
      setRenameFileError('Nombre de archivo inválido (1..255 caracteres)')
      return
    }
    setRenameFileError('')
    renameFileMutation.mutate({ id: renameFile.id, name: n })
  }

  useEffect(() => {
    if (!renameFile) return
    const t = setTimeout(() => {
      const el = renameFileInputRef.current
      if (el) {
        el.focus()
        try {
          el.setSelectionRange(0, el.value.length)
        } catch {
          el.select()
        }
      }
    }, 30)
    return () => clearTimeout(t)
  }, [renameFile])

  const [commentFile, setCommentFile] = useState<ApiFile | null>(null)
  const [commentContent, setCommentContent] = useState('')
  const [commentError, setCommentError] = useState('')
  const commentFileMutation = useMutation({
    mutationFn: (payload: { id: string; content: string }) =>
      apiCommentFile(payload.id, payload.content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'files', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'folders', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'detail', projectId] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
      setCommentFile(null)
      setCommentContent('')
      setCommentError('')
    },
    onError: (err: unknown) =>
      setCommentError(err instanceof Error ? err.message : 'Error desconocido'),
  })
  const commentFileInputRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (!commentFile) return
    const t = setTimeout(() => {
      const el = commentFileInputRef.current
      if (el) {
        el.focus()
        try {
          el.setSelectionRange(0, 0)
        } catch {}
      }
    }, 30)
    return () => clearTimeout(t)
  }, [commentFile])
  const handleCommentFileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentFile) return
    const trimmed = commentContent.trim()
    if (trimmed.length === 0 || trimmed.length > 2000) {
      setCommentError('El comentario debe tener entre 1 y 2000 caracteres')
      return
    }
    setCommentError('')
    commentFileMutation.mutate({ id: commentFile.id, content: trimmed })
  }

  const [transferDialog, setTransferDialog] = useState<{
    resource: { type: 'folder'; folder: ApiFolder } | { type: 'file'; file: ApiFile }
    mode: 'copy' | 'move'
    targetFolderId: string | null
    error: string
  } | null>(null)

  const transferFileMoveMutation = useMutation({
    mutationFn: (opts: { id: string; targetFolderId: string | null }) =>
      moveFile(opts.id, opts.targetFolderId),
  })
  const transferFileCopyMutation = useMutation({
    mutationFn: (opts: { id: string; targetFolderId: string | null }) =>
      copyFile(opts.id, { targetFolderId: opts.targetFolderId }),
  })
  const transferFolderMoveMutation = useMutation({
    mutationFn: (opts: { id: string; targetFolderId: string | null }) =>
      moveFolder(opts.id, opts.targetFolderId),
  })
  const transferFolderCopyMutation = useMutation({
    mutationFn: (opts: { id: string; targetFolderId: string | null }) =>
      copyFolder(opts.id, { targetParentId: opts.targetFolderId }),
  })

  const transferIsPending =
    transferFileMoveMutation.isPending ||
    transferFileCopyMutation.isPending ||
    transferFolderMoveMutation.isPending ||
    transferFolderCopyMutation.isPending

  const handleTransferSubmit = async (onClose: () => void) => {
    if (!transferDialog) return
    const t = transferDialog
    try {
      if (t.resource.type === 'file') {
        if (t.mode === 'move') {
          await transferFileMoveMutation.mutateAsync({
            id: t.resource.file.id,
            targetFolderId: t.targetFolderId,
          })
        } else {
          await transferFileCopyMutation.mutateAsync({
            id: t.resource.file.id,
            targetFolderId: t.targetFolderId,
          })
        }
      } else {
        if (t.mode === 'move') {
          await transferFolderMoveMutation.mutateAsync({
            id: t.resource.folder.id,
            targetFolderId: t.targetFolderId,
          })
        } else {
          await transferFolderCopyMutation.mutateAsync({
            id: t.resource.folder.id,
            targetFolderId: t.targetFolderId,
          })
        }
      }
      queryClient.invalidateQueries({ queryKey: ['project', 'folders', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'files', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'detail', projectId] })
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setTransferDialog((cur) => (cur ? { ...cur, error: msg } : cur))
    }
  }

  const disabledFolderIdsForTransfer = useMemo<Set<string>>(() => {
    if (!transferDialog || transferDialog.resource.type !== 'folder') return new Set<string>()
    const srcId = transferDialog.resource.folder.id
    const disabled = new Set<string>([srcId])
    function walk(node: FolderNode) {
      if (node.id === srcId) {
        function collect(n: FolderNode) {
          disabled.add(n.id)
          for (const c of n.children) collect(c)
        }
        for (const c of node.children) collect(c)
      } else {
        for (const c of node.children) walk(c)
      }
    }
    for (const r of folderTree) walk(r)
    return disabled
  }, [folderTree, transferDialog])

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) => deleteFile(fileId),
    onSuccess: (_data, deletedFileId) => {
      queryClient.invalidateQueries({ queryKey: ['project', 'files', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'folders', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'detail', projectId] })
      if (selectedResource?.type === 'file' && selectedResource.id === deletedFileId) {
        setSelectedResource(null)
      }
    },
  })

  const deleteFolderMutation = useMutation({
    mutationFn: (folderId: string) => deleteFolder(folderId),
    onSuccess: (_data, deletedFolderId) => {
      queryClient.invalidateQueries({ queryKey: ['project', 'folders', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'files', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'detail', projectId] })
      if (selectedFolderId === deletedFolderId) {
        setSelectedFolderId(null)
      }
      if (selectedResource?.type === 'folder' && selectedResource.id === deletedFolderId) {
        setSelectedResource(null)
      }
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadFile({
        projectId,
        folderId: selectedFolderId ?? undefined,
        file,
        onProgress: (p) => setUploadPercent(p),
      }),
    onMutate: () => {
      setIsUploading(true)
      setUploadPercent(0)
    },
    onSettled: () => {
      setIsUploading(false)
      setUploadPercent(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'files', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'folders', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'detail', projectId] })
    },
  })

  useEffect(() => {
    if (!folderContextMenu && !fileContextMenu) {
      setCtxClamp({})
    }
    if (!folderContextMenu && !fileContextMenu && !docsAreaContextMenu) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFolderContextMenu(null)
        setFileContextMenu(null)
        setDocsAreaContextMenu(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    const measure = () => {
      const MENU_W_MAX = 220
      const PAD = 4
      const next: typeof ctxClamp = {}
      if (folderContextMenu && folderCtxRef.current) {
        const el = folderCtxRef.current
        const w = Math.max(el.offsetWidth || MENU_W_MAX, MENU_W_MAX)
        const h = el.offsetHeight || 320
        const maxH = window.innerHeight - PAD * 2
        const availBelow = window.innerHeight - folderContextMenu.y - PAD
        const availAbove = folderContextMenu.y - PAD
        let top: number
        if (h <= availBelow) {
          top = folderContextMenu.y
        } else if (h <= availAbove) {
          top = folderContextMenu.y - h
        } else {
          top = Math.max(PAD, window.innerHeight - h - PAD)
        }
        const left = Math.min(
          Math.max(PAD, folderContextMenu.x),
          window.innerWidth - w - PAD
        )
        next.folder = { left, top, maxH }
      }
      if (fileContextMenu && fileCtxRef.current) {
        const el = fileCtxRef.current
        const w = Math.max(el.offsetWidth || MENU_W_MAX, MENU_W_MAX)
        const h = el.offsetHeight || 360
        const maxH = window.innerHeight - PAD * 2
        const availBelow = window.innerHeight - fileContextMenu.y - PAD
        const availAbove = fileContextMenu.y - PAD
        let top: number
        if (h <= availBelow) {
          top = fileContextMenu.y
        } else if (h <= availAbove) {
          top = fileContextMenu.y - h
        } else {
          top = Math.max(PAD, window.innerHeight - h - PAD)
        }
        const left = Math.min(
          Math.max(PAD, fileContextMenu.x),
          window.innerWidth - w - PAD
        )
        next.file = { left, top, maxH }
      }
      if (Object.keys(next).length) setCtxClamp(next)
    }

    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(measure)
      ;(measure as any)._raf2 = raf2
    })

    const onResize = () => measure()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf1)
      const r2 = (measure as any)._raf2
      if (r2) cancelAnimationFrame(r2)
    }
  }, [folderContextMenu, fileContextMenu, docsAreaContextMenu])

  useEffect(() => {
    if (!pageToast) return
    const t = setTimeout(() => setPageToast(null), 6500)
    return () => clearTimeout(t)
  }, [pageToast])

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    uploadMutation.mutate(f)
  }

  const ownerNameText = useMemo<string>(() => {
    if (!project?.ownerId) return 'Propietario'
    if (!membersQuery.data?.items.length) return 'Propietario'
    const m = membersQuery.data.items.find((x) => x.userId === project.ownerId)
    if (!m) return 'Propietario'
    return m.fullName || m.email || 'Propietario'
  }, [membersQuery.data, project])

  const filesIsLoading = filesQuery.isLoading && filesQuery.fetchStatus !== 'idle'
  const foldersAreLoading = foldersQuery.isLoading && foldersQuery.fetchStatus !== 'idle'

  const selectedId = selectedResource?.id
  const selectedType = selectedResource?.type

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-2 pb-0 border-b border-border bg-surface/95 dark:bg-surface-primary/95 backdrop-blur sticky top-0 z-30 shrink-0 shadow-[0_1px_0_0_rgba(0,0,0,0.02)] -mx-6 mb-4">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1.5">
          <Link
            to="/projects"
            className="hover:text-brand-600 dark:hover:text-brand-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 rounded"
          >
            Proyectos
          </Link>
          <ChevronRight className="w-2.5 h-2.5 shrink-0 opacity-60" />
          <span className="text-foreground font-medium truncate min-w-0">
            {detailIsLoading ? 'Cargando…' : project?.name || '—'}
          </span>
        </div>

        <div className="flex items-stretch gap-3 min-w-0">
          <div
            className={clsx(
              'w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0 shadow-sm ring-1 ring-black/5',
              project ? projectGradientClass(project.color) : 'from-brand-500 to-brand-700'
            )}
            aria-hidden="true"
          >
            <FolderKanban className="w-4.5 h-4.5 text-white drop-shadow-sm" />
          </div>

          <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
            {detailIsLoading ? (
              <div className="space-y-1 pt-0.5">
                <div className="h-5 w-[65%] max-w-[600px] bg-surface-secondary rounded-md animate-pulse" />
                <div className="flex items-center gap-1.5 h-3.5">
                  <div className="h-3.5 w-24 bg-surface-secondary rounded-full animate-pulse" />
                  <div className="h-2.5 w-20 bg-surface-secondary rounded animate-pulse" />
                  <div className="h-2.5 w-20 bg-surface-secondary rounded animate-pulse" />
                  <div className="h-2.5 w-32 bg-surface-secondary rounded animate-pulse" />
                </div>
              </div>
            ) : project ? (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <h1
                    className="text-[17px] leading-[1.2] font-bold text-foreground truncate"
                    title={project.name}
                  >
                    {project.name}
                  </h1>
                  {headerBadge && (
                    <span
                      className={clsx(
                        'px-1.5 py-[0px] rounded-full text-[10.5px] font-medium h-[16px] inline-flex items-center shrink-0 ring-1 ring-black/5',
                        headerBadge.bgClass,
                        headerBadge.textClass
                      )}
                    >
                      {headerBadge.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground flex-wrap min-w-0">
                  <span className="inline-flex items-center min-w-0">
                    <span className="truncate">{ownerNameText}</span>
                  </span>
                  <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/40 shrink-0" />
                  <span className="tabular-nums shrink-0">
                    {stats?.membersCount ?? project.membersCount} miembros
                  </span>
                  <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/40 shrink-0" />
                  <span className="tabular-nums shrink-0">
                    Actualizado {formatRelativeTime(project.updatedAt ?? project.createdAt)}
                  </span>
                </div>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5 ml-auto shrink-0 self-center">
            <button
              aria-label={
                project && isLocalFavorite('PROJECT', project.id)
                  ? 'Quitar proyecto de favoritos'
                  : 'Marcar proyecto como favorito'
              }
              title={
                project && isLocalFavorite('PROJECT', project.id)
                  ? 'Quitar de favoritos'
                  : 'Añadir a favoritos'
              }
              disabled={!project}
              onClick={() => project && handleToggleFavorite('PROJECT', project.id)}
              className={clsx(
                'btn-secondary text-[11.5px] px-2.5 h-8 min-w-[32px] focus-visible:ring-2 focus-visible:ring-brand-500/60',
                project && isLocalFavorite('PROJECT', project.id) &&
                  'text-status-review ring-1 ring-status-review/25 bg-status-review/8'
              )}
            >
              <Star
                className={clsx(
                  'w-3.5 h-3.5',
                  project && isLocalFavorite('PROJECT', project.id) && 'fill-current'
                )}
              />
              <span className="hidden sm:inline">
                {project && isLocalFavorite('PROJECT', project.id) ? 'Favorito' : 'Favoritos'}
              </span>
            </button>
            <button
              className="btn-secondary text-[11.5px] px-2.5 h-8 min-w-[32px] focus-visible:ring-2 focus-visible:ring-brand-500/60"
              aria-label="Invitar miembros al proyecto"
              title="Invitar miembros"
              disabled={!project || !canManageMembers}
              onClick={() => {
                setShowInviteMember(true)
                setInviteSelectedUserId(null)
                setInviteSearch('')
                setInviteError('')
              }}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Invitar</span>
            </button>
            <button
              className="btn-primary text-[11.5px] px-2.5 h-8 min-w-[32px] focus-visible:ring-2 focus-visible:ring-brand-500/60"
              disabled={!project || isUploading}
              onClick={() => fileInputRef.current?.click()}
              aria-label={isUploading ? `Subiendo archivo ${uploadPercent}%` : 'Subir archivo al proyecto'}
              title={isUploading ? `Subiendo ${uploadPercent}%` : 'Subir archivo'}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">Subiendo {uploadPercent}%</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Subir</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={onFilePicked}
              disabled={!project || isUploading}
              multiple
            />
            <div className="relative">
              <button
                className="btn-secondary p-1 h-8 w-8 focus-visible:ring-2 focus-visible:ring-brand-500/60"
                disabled={!project}
                onClick={() => setHeaderMenuOpen((v) => !v)}
                aria-label={headerMenuOpen ? 'Cerrar menú acciones proyecto' : 'Abrir menú acciones proyecto'}
                title="Más acciones proyecto"
                aria-haspopup="menu"
                aria-expanded={headerMenuOpen}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {headerMenuOpen && project && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setHeaderMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    className="absolute right-0 mt-1 w-52 card p-0.5 z-20 text-[12px] shadow-xl ring-1 ring-black/5"
                    role="menu"
                  >
                    <button
                      role="menuitem"
                      onClick={() => {
                        setHeaderMenuOpen(false)
                        openEditProject()
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded-md hover:bg-surface-secondary text-foreground h-8 focus-visible:ring-2 focus-visible:ring-brand-500/60 focus:outline-none"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                      Editar proyecto
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        setHeaderMenuOpen(false)
                        project && handleToggleFavorite('PROJECT', project.id)
                      }}
                      className={clsx(
                        'w-full flex items-center gap-2 px-2 py-1 rounded-md h-8 focus-visible:ring-2 focus-visible:ring-brand-500/60 focus:outline-none',
                        project && isLocalFavorite('PROJECT', project.id)
                          ? 'bg-status-review/8 text-status-review hover:bg-status-review/15'
                          : 'hover:bg-surface-secondary text-foreground'
                      )}
                    >
                      <Star
                        className={clsx(
                          'w-3.5 h-3.5',
                          project && isLocalFavorite('PROJECT', project.id) && 'fill-current'
                        )}
                      />
                      {project && isLocalFavorite('PROJECT', project.id)
                        ? 'Quitar de favoritos'
                        : 'Añadir a favoritos'}
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        setHeaderMenuOpen(false)
                        setShowDeleteProject(true)
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded-md hover:bg-status-blocked/15 text-status-blocked h-8 focus-visible:ring-2 focus-visible:ring-status-blocked/50 focus:outline-none"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Mover a papelera
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <nav
          className="mt-2 -mx-4 px-4 border-b border-border overflow-x-auto scrollbar-thin"
          aria-label="Pestañas del proyecto"
        >
          <div className="flex gap-1 pb-1 min-w-max" role="tablist">
            {tabs.map((t) => {
              const Icon = t.icon
              const isActive = activeTab === t.id
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveTab(t.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-2.5 rounded-md text-[11.5px] font-medium whitespace-nowrap transition-colors h-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60',
                    isActive
                      ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300 ring-1 ring-brand-500/30 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface-secondary'
                  )}
                  title={t.label}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </nav>
      </header>

      {activeTab === 'docs' && (
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
                        docMaestroCarpetaId={project?.docMaestroCarpetaId ?? null}
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
                  {(visibleFoldersCurrentLevel.length + (filesQuery.data?.items?.length ?? 0)) > 0 && (
                    <span className="hidden sm:inline-flex items-center px-1.5 h-6 rounded-md bg-surface-secondary ring-1 ring-border text-[10.5px] tabular-nums text-muted-foreground font-medium">
                      {visibleFoldersCurrentLevel.length + (filesQuery.data?.items?.length ?? 0)} elementos
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
                  disabled={!project || createFolderMutation.isPending}
                  title="Crear una nueva subcarpeta dentro de la ubicación actual"
                >
                  {createFolderMutation.isPending ? (
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
                    (filesQuery.data?.items?.length ?? 0) === 0 ? (
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
                      {filesQuery.data?.items.map((file: ApiFile) => {
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
      )}

      {activeTab === 'team' && (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-foreground">Equipo del proyecto</h2>
              {canManageMembers && (
                <button
                  className="btn-secondary text-[11.5px] px-2.5 h-8 min-w-[32px] focus-visible:ring-2 focus-visible:ring-brand-500/60"
                  onClick={() => {
                    setShowInviteMember(true)
                    setInviteSelectedUserId(null)
                    setInviteSearch('')
                    setInviteError('')
                  }}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline ml-1.5">Agregar miembro</span>
                </button>
              )}
            </div>
            <div className="card divide-y divide-border overflow-hidden">
              {membersQuery.isLoading && membersQuery.fetchStatus !== 'idle' ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-surface-secondary" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-48 bg-surface-secondary rounded" />
                      <div className="h-3 w-64 bg-surface-secondary rounded" />
                    </div>
                    <div className="h-4 w-20 bg-surface-secondary rounded" />
                  </div>
                ))
              ) : !membersQuery.data?.items.length ? (
                <div className="p-8 text-center text-muted-foreground">
                  Aún no hay miembros.
                </div>
              ) : (
                membersQuery.data.items.map((m) => {
                  const isOwner = project && m.userId === project.ownerId
                  const canRemove = canManageMembers && !isOwner
                  return (
                    <div key={m.id} className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-brand-500/20 text-brand-300 dark:text-brand-200 flex items-center justify-center font-semibold shrink-0">
                        {m.avatarUrl ? (
                          <img src={m.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          initials(m.fullName)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground truncate">
                          {m.fullName || 'Usuario sin nombre'}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {m.email || 'Sin correo'}
                        </div>
                      </div>
                      <div className="text-xs px-2 py-1 rounded-full bg-surface-secondary text-gray-300 shrink-0">
                        {m.roleName || (isOwner ? 'Propietario' : 'Miembro')}
                      </div>
                      {canRemove && (
                        <button
                          className="btn-ghost p-1 rounded-md h-8 w-8 shrink-0 text-muted-foreground hover:text-status-blocked hover:bg-status-blocked/10 focus-visible:ring-2 focus-visible:ring-status-blocked/50 focus:outline-none"
                          title="Retirar del proyecto"
                          aria-label={`Retirar ${m.fullName || m.email || 'miembro'} del proyecto`}
                          onClick={() => setConfirmRemoveMember(m)}
                          disabled={removeMemberMutation.isPending}
                        >
                          {removeMemberMutation.isPending && confirmRemoveMember?.id === m.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <UserMinus className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'master' && (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {!project ? null : (() => {
            const documentoMaestro: ProjectMasterDocInfo | null = detail?.documentoMaestro ?? null
            const hasMaster = Boolean(documentoMaestro)
            return (
              <div className="max-w-3xl mx-auto space-y-4">
                {hasMaster && documentoMaestro ? (
                  <div className="card overflow-hidden">
                    <div className="p-4 border-b border-border bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent dark:from-brand-500/20 dark:via-brand-500/10">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-lg bg-brand-500/25 flex items-center justify-center shrink-0 ring-1 ring-black/5">
                          <FileCheck2 className="w-5 h-5 text-brand-600 dark:text-brand-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[11px] uppercase tracking-wider font-semibold text-brand-600 dark:text-brand-300">
                              Documento maestro designado
                            </p>
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/5 text-muted-foreground ring-1 ring-black/5">
                              {documentoMaestro.resourceType === 'FOLDER' ? <Folder className="w-3 h-3" /> : <File className="w-3 h-3" />}
                              {documentoMaestro.resourceType === 'FOLDER' ? 'Carpeta' : 'Archivo'}
                            </span>
                          </div>
                          <h2 className="mt-1.5 text-[17px] font-semibold text-foreground truncate" title={documentoMaestro.name}>
                            {documentoMaestro.name}
                          </h2>
                          {documentoMaestro.path && documentoMaestro.path !== '/' && (
                            <p className="mt-0.5 text-xs text-muted-foreground truncate" title={documentoMaestro.path}>
                              /{documentoMaestro.path}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground mb-0.5">Actualizado</p>
                        <p className="text-foreground font-medium">
                          {documentoMaestro.lastUpdatedAt ? formatRelativeTime(documentoMaestro.lastUpdatedAt) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-0.5">Propietario</p>
                        <p className="text-foreground font-medium truncate" title={documentoMaestro.ownerName || ''}>
                          {documentoMaestro.ownerName || '—'}
                        </p>
                      </div>
                      {documentoMaestro.resourceType === 'FILE' ? (
                        <div>
                          <p className="text-muted-foreground mb-0.5">Tamaño</p>
                          <p className="text-foreground font-medium">
                            {typeof documentoMaestro.size === 'number' ? formatBytes(documentoMaestro.size) : '—'}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-muted-foreground mb-0.5">Tipo</p>
                          <p className="text-foreground font-medium">Espacio maestro</p>
                        </div>
                      )}
                      <div>
                        <p className="text-muted-foreground mb-0.5">Identificador</p>
                        <p className="text-foreground font-mono text-[11px] truncate" title={documentoMaestro.resourceId}>
                          {String(documentoMaestro.resourceId).slice(0, 8)}…
                        </p>
                      </div>
                    </div>
                    <div className="p-4 border-t border-border flex items-center justify-end gap-2 bg-surface-secondary/30">
                      <button
                        type="button"
                        onClick={() => {
                          if (documentoMaestro.resourceType === 'FOLDER') {
                            setSelectedFolderId(documentoMaestro.resourceId)
                            setActiveTab('docs')
                          } else {
                            setSelectedResource({ projectId, type: 'file', id: documentoMaestro.resourceId })
                            if (!rightPanelOpen) toggleRightPanel()
                            setActiveTab('docs')
                          }
                        }}
                        className="btn-secondary text-sm"
                      >
                        <Compass className="w-4 h-4" />
                        Abrir
                      </button>
                      {canAdminMaster && (
                        <button
                          type="button"
                          onClick={() => setShowConfirmClearMaster(true)}
                          disabled={clearMasterMutation.isPending}
                          className="btn-ghost text-sm text-status-blocked hover:bg-status-blocked/10 hover:text-status-blocked"
                        >
                          {clearMasterMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Quitando…
                            </>
                          ) : (
                            <>
                              <X className="w-4 h-4" />
                              Quitar designación
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="card overflow-hidden text-center">
                    <div className="p-8">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-secondary flex items-center justify-center mb-4 ring-1 ring-black/5">
                        <FileCheck2 className="w-7 h-7 opacity-50" />
                      </div>
                      <h2 className="text-[17px] font-semibold text-foreground">
                        Sin documento maestro
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                        Designa una carpeta o archivo como el punto de entrada principal del proyecto.
                        El contenido aparecerá destacado y podrá abrirse directamente desde aquí.
                      </p>
                    </div>
                    {canAdminMaster && (
                      <div className="p-4 border-t border-border bg-surface-secondary/40 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            setMasterSelectorTab(selectedFolderId ? 'folders' : 'files')
                            setMasterSelectedFolderId(selectedFolderId)
                            setMasterSelectedFileId(null)
                            setShowMasterSelector(true)
                          }}
                          className="btn-primary text-sm"
                        >
                          <FileCheck2 className="w-4 h-4" />
                          Designar documento maestro
                        </button>
                      </div>
                    )}
                    {!canAdminMaster && (
                      <div className="p-4 border-t border-border bg-surface-secondary/20 text-xs text-muted-foreground">
                        Solo el propietario del proyecto o un administrador puede designar el documento maestro.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {activeTab !== 'docs' && activeTab !== 'team' && activeTab !== 'master' && (
        <div className="flex-1 flex items-center justify-center text-center p-8 overflow-y-auto">
          <div className="text-muted-foreground">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-secondary flex items-center justify-center mb-4">
              <Compass className="w-8 h-8 opacity-40" />
            </div>
            <p className="font-medium text-foreground">Módulo en construcción</p>
            <p className="text-sm mt-1">
              La pestaña{' '}
              <strong className="text-brand-600 dark:text-brand-300">
                {tabs.find((t) => t.id === activeTab)?.label}
              </strong>{' '}
              estará disponible próximamente.
            </p>
          </div>
        </div>
      )}

      {showNewFolder && project && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleCreateFolder}
            className="card w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Nueva carpeta</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  En:{' '}
                  <span className="text-foreground">
                    {selectedFolderId == null
                      ? 'Raíz del proyecto'
                      : flatFolderById.get(selectedFolderId)?.name || selectedFolderId}
                  </span>
                </p>
              </div>
              <button
                type="button"
                disabled={createFolderMutation.isPending}
                onClick={() => {
                  setShowNewFolder(false)
                  setNewFolderName('')
                  setNewFolderError('')
                }}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-secondary"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {createFolderMutation.error || newFolderError ? (
                <div className="text-xs rounded-md p-2.5 bg-status-blocked/15 border border-status-blocked/40 text-destructive/90">
                  {newFolderError || (createFolderMutation.error instanceof Error ? createFolderMutation.error.message : 'Error desconocido')}
                </div>
              ) : null}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Nombre de carpeta <span className="text-status-blocked">*</span>
                </label>
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  maxLength={255}
                  placeholder="Ej. Documentos legales"
                  className="input-base w-full"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => {
                  setShowNewFolder(false)
                  setNewFolderName('')
                  setNewFolderError('')
                }}
                disabled={createFolderMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary text-sm"
                disabled={createFolderMutation.isPending}
              >
                {createFolderMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creando…
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Crear carpeta
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {renameFolder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => {
            setRenameFolder(null)
            setRenameFolderName('')
            setRenameFolderError('')
          }}
        >
          <form
            onSubmit={handleRenameFolder}
            className="card w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Renombrar carpeta</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Nombre actual:{' '}
                  <span className="text-foreground">{renameFolder.name}</span>
                </p>
              </div>
              <button
                type="button"
                disabled={renameFolderMutation.isPending}
                onClick={() => {
                  setRenameFolder(null)
                  setRenameFolderName('')
                  setRenameFolderError('')
                }}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-secondary"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {renameFolderMutation.error || renameFolderError ? (
                <div className="text-xs rounded-md p-2.5 bg-status-blocked/15 border border-status-blocked/40 text-destructive/90">
                  {renameFolderError ||
                    (renameFolderMutation.error instanceof Error
                      ? renameFolderMutation.error.message
                      : 'Error desconocido')}
                </div>
              ) : null}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Nuevo nombre <span className="text-status-blocked">*</span>
                </label>
                <input
                  autoFocus
                  value={renameFolderName}
                  onChange={(e) => setRenameFolderName(e.target.value)}
                  maxLength={255}
                  placeholder="Ej. Documentos legales"
                  className="input-base w-full"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => {
                  setRenameFolder(null)
                  setRenameFolderName('')
                  setRenameFolderError('')
                }}
                disabled={renameFolderMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={(e) => {
                  e.preventDefault()
                  if (renameFolderMutation.isPending) return
                  const form = e.currentTarget.closest('form')
                  const input = form?.querySelector<HTMLInputElement>('input[type=\"text\"], input:not([type])')
                  const raw = input?.value ?? renameFolderName
                  const n = raw.trim()
                  if (n.length === 0 || n.length > 255) {
                    setRenameFolderError('Nombre de carpeta inválido (1..255 caracteres)')
                    return
                  }
                  setRenameFolderName(n)
                  setRenameFolderError('')
                  renameFolderMutation.mutate({ id: renameFolder.id, name: n })
                }}
                disabled={renameFolderMutation.isPending}
              >
                {renameFolderMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Guardar
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {renameFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => {
            setRenameFile(null)
            setRenameFileName('')
            setRenameFileError('')
          }}
        >
          <form
            onSubmit={handleRenameFile}
            className="card w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Renombrar archivo</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Nombre actual:{' '}
                  <span className="text-foreground">{renameFile.name}</span>
                </p>
              </div>
              <button
                type="button"
                disabled={renameFileMutation.isPending}
                onClick={() => {
                  setRenameFile(null)
                  setRenameFileName('')
                  setRenameFileError('')
                }}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-secondary"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {renameFileMutation.error || renameFileError ? (
                <div className="text-xs rounded-md p-2.5 bg-status-blocked/15 border border-status-blocked/40 text-destructive/90">
                  {renameFileError ||
                    (renameFileMutation.error instanceof Error
                      ? renameFileMutation.error.message
                      : 'Error desconocido')}
                </div>
              ) : null}
              {(() => {
                const n = renameFile.name
                const dot = n.lastIndexOf('.')
                const ext = dot > 0 ? n.slice(dot) : ''
                return (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">
                      Nuevo nombre <span className="text-status-blocked">*</span>
                    </label>
                    <div className="flex items-stretch w-full rounded-lg border border-border bg-surface focus-within:ring-2 focus-within:ring-accent/40 focus-within:border-accent overflow-hidden transition-all">
                      <input
                        ref={renameFileInputRef}
                        autoFocus
                        value={renameFileName}
                        onChange={(e) => setRenameFileName(e.target.value)}
                        maxLength={245}
                        placeholder="Ej. Inventario actualizado"
                        className="flex-1 bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-w-0"
                      />
                      {ext && (
                        <div className="flex items-center px-3 py-2 bg-surface-secondary border-l border-border text-xs text-accent font-semibold select-none whitespace-nowrap">
                          {ext}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => {
                  setRenameFile(null)
                  setRenameFileName('')
                  setRenameFileError('')
                }}
                disabled={renameFileMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={(e) => {
                  e.preventDefault()
                  if (renameFileMutation.isPending) return
                  const form = e.currentTarget.closest('form')
                  const input = form?.querySelector<HTMLInputElement>('input[type=\"text\"], input:not([type])')
                  const raw = input?.value ?? renameFileName
                  const n = raw.trim()
                  if (n.length === 0 || n.length > 255) {
                    setRenameFileError('Nombre de archivo inválido (1..255 caracteres)')
                    return
                  }
                  setRenameFileName(n)
                  setRenameFileError('')
                  renameFileMutation.mutate({ id: renameFile.id, name: n })
                }}
                disabled={renameFileMutation.isPending}
              >
                {renameFileMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Guardar
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {commentFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => {
            setCommentFile(null)
            setCommentContent('')
            setCommentError('')
          }}
        >
          <form
            onSubmit={handleCommentFileSubmit}
            className="card w-full max-w-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-brand-500" />
                  Comentar archivo
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="text-foreground font-medium">{commentFile.name}</span>
                  {' · '}
                  El comentario será visible para todo el equipo.
                </p>
              </div>
              <button
                type="button"
                disabled={commentFileMutation.isPending}
                onClick={() => {
                  setCommentFile(null)
                  setCommentContent('')
                  setCommentError('')
                }}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-secondary"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {commentFileMutation.error || commentError ? (
                <div className="text-xs rounded-md p-2.5 bg-status-blocked/15 border border-status-blocked/40 text-destructive/90">
                  {commentError ||
                    (commentFileMutation.error instanceof Error
                      ? commentFileMutation.error.message
                      : 'Error desconocido')}
                </div>
              ) : null}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Tu comentario <span className="text-status-blocked">*</span>
                </label>
                <textarea
                  ref={commentFileInputRef}
                  autoFocus
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  placeholder="Escribe un comentario o aportación sobre este archivo…"
                  className="input-base w-full resize-y min-h-[120px]"
                />
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-[11px] text-muted-foreground">
                    Se publicará y quedará asociado al documento.
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {commentContent.length}
                    <span className="text-muted-foreground/60"> / 2000</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => {
                  setCommentFile(null)
                  setCommentContent('')
                  setCommentError('')
                }}
                disabled={commentFileMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary text-sm"
                onClick={(e) => {
                  e.preventDefault()
                  if (commentFileMutation.isPending) return
                  const trimmed = commentContent.trim()
                  if (trimmed.length === 0 || trimmed.length > 2000) {
                    setCommentError('El comentario debe tener entre 1 y 2000 caracteres')
                    return
                  }
                  setCommentError('')
                  commentFileMutation.mutate({ id: commentFile.id, content: trimmed })
                }}
                disabled={commentFileMutation.isPending}
              >
                {commentFileMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Publicando…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Publicar
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {transferDialog && (() => {
        const close = () => setTransferDialog(null)
        const t = transferDialog
        const resourceLabel =
          t.resource.type === 'folder' ? t.resource.folder.name : t.resource.file.name
        const resourceKind = t.resource.type === 'folder' ? 'carpeta' : 'archivo'
        const isRootSelected = t.targetFolderId === null
        const canSubmit =
          !transferIsPending &&
          (t.resource.type === 'file' ||
            !disabledFolderIdsForTransfer.has(t.targetFolderId ?? '__never__'))
        const selectTarget = (folderId: string | null) =>
          setTransferDialog({ ...t, targetFolderId: folderId, error: '' })

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={close}
          >
            <div
              className="card w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {t.mode === 'copy' ? 'Copiar' : 'Mover'} {resourceKind}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">
                    {resourceLabel}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={transferIsPending}
                  onClick={close}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-secondary disabled:opacity-50"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto">
                <div>
                  <label className="block xs:text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">
                    Acción (elige antes de confirmar)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['move', 'copy'] as const).map((mode) => {
                      const active = t.mode === mode
                      return (
                        <button
                          key={mode}
                          type="button"
                          disabled={transferIsPending}
                          onClick={() =>
                            setTransferDialog({ ...t, mode, error: '' })
                          }
                          className={clsx(
                            'flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all',
                            active
                              ? mode === 'move'
                                ? 'bg-brand-600/20 border-brand-500 text-brand-800 dark:bg-brand-500/20 dark:text-brand-100 shadow-sm'
                                : 'bg-amber-500/15 border-amber-500/60 text-amber-800 dark:text-amber-200'
                              : 'border-border hover:bg-surface-secondary text-foreground'
                          )}
                        >
                          {mode === 'move' ? (
                            <>
                              <ArrowRightLeft className="w-4 h-4" />
                              Mover
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copiar
                            </>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <div
                    className={clsx(
                      'mt-3 rounded-md border px-3 py-2 text-xs flex items-start gap-2',
                      t.mode === 'move'
                        ? 'bg-brand-500/10 border-brand-500/40 text-brand-800 dark:text-brand-200'
                        : 'bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-200'
                    )}
                  >
                    <span className="mt-0.5">
                      {t.mode === 'move' ? (
                        <ArrowRightLeft className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </span>
                    <span className="leading-snug">
                      <strong>
                        {t.mode === 'move' ? 'MODO MOVER:' : 'MODO COPIAR:'}
                      </strong>{' '}
                      {t.mode === 'move'
                        ? `el ${resourceKind} se ELIMINARÁ de su carpeta actual y solo quedará en el destino.`
                        : `se CREARÁ una copia en el destino; el ${resourceKind} original permanece intacto.`}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs text-muted-foreground font-medium">
                      Carpeta destino
                    </label>
                    <span className="text-[11px] text-muted-foreground">
                      {t.resource.type === 'folder' &&
                        '(carpeta propia y subcarpetas deshabilitadas)'}
                    </span>
                  </div>
                  <div className="border border-border rounded-lg p-2 bg-surface-secondary/30 space-y-0.5 max-h-64 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => selectTarget(null)}
                      className={clsx(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors',
                        isRootSelected
                          ? 'bg-brand-600/15 ring-1 ring-brand-500/60 text-foreground'
                          : 'text-foreground hover:bg-surface-secondary'
                      )}
                    >
                      <FolderKanban className="w-4 h-4 text-brand-600 dark:text-brand-300" />
                      <span className="truncate font-medium">Raíz del proyecto</span>
                    </button>
                    {folderTree.length > 0 ? (
                      folderTree.map((r) => (
                        <TransferTargetTreeItem
                          key={r.id}
                          node={r}
                          depth={0}
                          disabledFolderIds={disabledFolderIdsForTransfer}
                          selectedTargetFolderId={t.targetFolderId}
                          onSelect={(id) => selectTarget(id)}
                        />
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        No hay otras carpetas en el proyecto
                      </div>
                    )}
                  </div>
                </div>

                {(t.error ||
                  transferFileMoveMutation.error ||
                  transferFileCopyMutation.error ||
                  transferFolderMoveMutation.error ||
                  transferFolderCopyMutation.error) && (
                  <div className="text-xs rounded-md p-2.5 bg-status-blocked/15 border border-status-blocked/40 text-destructive/90">
                    {t.error ||
                      (transferFileMoveMutation.error instanceof Error
                        ? transferFileMoveMutation.error.message
                        : null) ||
                      (transferFileCopyMutation.error instanceof Error
                        ? transferFileCopyMutation.error.message
                        : null) ||
                      (transferFolderMoveMutation.error instanceof Error
                        ? transferFolderMoveMutation.error.message
                        : null) ||
                      (transferFolderCopyMutation.error instanceof Error
                        ? transferFolderCopyMutation.error.message
                        : null) ||
                      'Error desconocido'}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={close}
                  disabled={transferIsPending}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={clsx(
                    'text-sm font-semibold',
                    t.mode === 'move' ? 'btn-primary' : 'btn-secondary'
                  )}
                  disabled={!canSubmit}
                  onClick={() => handleTransferSubmit(close)}
                >
                  {transferIsPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t.mode === 'copy' ? 'Copiando…' : 'Moviendo…'}
                    </>
                  ) : (
                    <>
                      {t.mode === 'move' ? (
                        <ArrowRightLeft className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {t.mode === 'copy'
                        ? 'Confirmar copia'
                        : 'Confirmar movimiento'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {showEditProject && project && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleSubmitEdit}
            className="card w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Editar proyecto</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Actualiza la información del espacio de trabajo.</p>
              </div>
              <button
                type="button"
                disabled={updateMutation.isPending}
                onClick={() => setShowEditProject(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-secondary"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {editForm.errors._global && (
                <div className="text-xs rounded-md p-2.5 bg-status-blocked/15 border border-status-blocked/40 text-destructive/90">
                  {editForm.errors._global}
                </div>
              )}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Nombre <span className="text-status-blocked">*</span></label>
                <input
                  autoFocus
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  maxLength={200}
                  className={clsx('input-base w-full', editForm.errors.name && 'ring-1 ring-status-blocked')}
                />
                {editForm.errors.name && (
                  <p className="text-xs text-status-blocked mt-1">{editForm.errors.name}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Descripción</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                  maxLength={2000}
                  className="input-base w-full resize-none"
                />
                {editForm.errors.description && (
                  <p className="text-xs text-status-blocked mt-1">{editForm.errors.description}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Estado</label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, status: e.target.value as ApiProjectStatus }))
                  }
                  className="input-base w-full bg-surface"
                >
                  <option value="PENDING">Borrador</option>
                  <option value="ACTIVE">En construcción</option>
                  <option value="COMPLETED">Completado</option>
                  <option value="INACTIVE">Inactivo</option>
                  <option value="ARCHIVED">Archivado</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={updateMutation.isPending}
                onClick={() => setShowEditProject(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary text-sm"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Guardar cambios
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {showMasterSelector && project && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => {
            if (!designateMasterMutation.isPending) setShowMasterSelector(false)
          }}
        >
          <div
            className="card w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Designar documento maestro</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Selecciona la carpeta o archivo que actuará como punto de entrada principal del proyecto.
                </p>
              </div>
              <button
                type="button"
                disabled={designateMasterMutation.isPending}
                onClick={() => setShowMasterSelector(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-secondary"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-b border-border bg-surface-secondary/40 px-4 flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setMasterSelectorTab('folders')
                  setMasterSelectedFileId(null)
                }}
                className={clsx(
                  'px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
                  masterSelectorTab === 'folders'
                    ? 'border-brand-500 text-brand-600 dark:text-brand-300'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5" />
                  Carpetas
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMasterSelectorTab('files')
                  setMasterSelectedFolderId(null)
                }}
                className={clsx(
                  'px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
                  masterSelectorTab === 'files'
                    ? 'border-brand-500 text-brand-600 dark:text-brand-300'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  <File className="w-3.5 h-3.5" />
                  Archivos
                </span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {masterSelectorTab === 'folders' ? (
                <div className="space-y-0.5">
                  {folderTree.length > 0 ? (
                    folderTree.map((r) => (
                      <MasterFolderTreeItem
                        key={r.id}
                        node={r}
                        depth={0}
                        selectedFolderId={masterSelectedFolderId}
                        onSelect={(id) => setMasterSelectedFolderId(id)}
                      />
                    ))
                  ) : (
                    <div className="px-3 py-6 text-xs text-muted-foreground text-center">
                      <Folder className="w-5 h-5 opacity-40 mx-auto mb-2" />
                      El proyecto aún no tiene carpetas creadas. Crea una primero o designa un archivo.
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filesIsLoading ? (
                    <div className="px-3 py-6 text-xs text-muted-foreground text-center">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 opacity-50" />
                      Cargando archivos…
                    </div>
                  ) : !filesQuery.data?.items?.length ? (
                    <div className="px-3 py-6 text-xs text-muted-foreground text-center">
                      No hay archivos en la ubicación actual. Puedes cambiar la carpeta seleccionada en la pestaña Documentos para ver más.
                    </div>
                  ) : (
                    filesQuery.data.items.map((f) => {
                      const KindIcon = iconForKind(fileKind(f))
                      const sel = masterSelectedFileId === f.id
                      return (
                        <button
                          type="button"
                          key={f.id}
                          onClick={() => setMasterSelectedFileId(f.id)}
                          className={clsx(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left transition-colors',
                            sel ? 'bg-brand-600/15 ring-1 ring-brand-500/60 text-foreground' : 'text-foreground hover:bg-surface-secondary'
                          )}
                        >
                          <div className={clsx('w-8 h-8 rounded-md flex items-center justify-center shrink-0', colorForKind(fileKind(f)))}>
                            <KindIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{f.name}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {typeof f.sizeBytes === 'number' ? formatBytes(f.sizeBytes) : 'Sin tamaño'} · {formatRelativeTime(f.updatedAt ?? f.createdAt)}
                            </p>
                          </div>
                          {sel && (
                            <Check className="w-4 h-4 ml-2 text-brand-600 dark:text-brand-300 shrink-0" />
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border bg-surface-secondary/40 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => setShowMasterSelector(false)}
                disabled={designateMasterMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={
                  designateMasterMutation.isPending ||
                  (masterSelectorTab === 'folders' && !masterSelectedFolderId) ||
                  (masterSelectorTab === 'files' && !masterSelectedFileId)
                }
                onClick={handleMasterDesignateSubmit}
              >
                {designateMasterMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Designando…
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Designar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmClearMaster && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => {
            if (!clearMasterMutation.isPending) setShowConfirmClearMaster(false)
          }}
        >
          <div
            className="card w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-status-blocked/15 flex items-center justify-center shrink-0 ring-1 ring-black/5">
                  <ShieldAlert className="w-5 h-5 text-status-blocked" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-foreground">Quitar documento maestro</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Esta acción desvincula el documento o carpeta actualmente designada como maestro del proyecto.
                    El contenido no se eliminará, solo deja de estar marcado como principal.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => setShowConfirmClearMaster(false)}
                disabled={clearMasterMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-ghost text-sm text-status-blocked hover:bg-status-blocked/10 hover:text-status-blocked"
                onClick={() => clearMasterMutation.mutate()}
                disabled={clearMasterMutation.isPending}
              >
                {clearMasterMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Quitando…
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Sí, quitar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {folderContextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setFolderContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault()
              setFolderContextMenu(null)
            }}
          />
          <div
            ref={folderCtxRef}
            className="fixed z-50 w-52 card p-1 text-sm shadow-2xl overflow-y-auto"
            style={{
              left: ctxClamp.folder?.left ?? folderContextMenu.x,
              top: ctxClamp.folder?.top ?? folderContextMenu.y,
              maxHeight: ctxClamp.folder?.maxH ? `${ctxClamp.folder.maxH}px` : undefined,
            }}
          >
            <button
              onClick={() => {
                const f = folderContextMenu.folder
                setFolderContextMenu(null)
                setSelectedFolderId(f.id)
                setSelectedResource({ type: 'folder', id: f.id, projectId })
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground"
            >
              <FolderOpen className="w-4 h-4" />
              Abrir
            </button>
            <button
              onClick={() => {
                const f = folderContextMenu.folder
                setFolderContextMenu(null)
                setRenameFolder(f)
                setRenameFolderName(f.name)
                setRenameFolderError('')
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground"
            >
              <Edit3 className="w-4 h-4" />
              Renombrar
            </button>
            <button
              onClick={() => {
                const f = folderContextMenu.folder
                setFolderContextMenu(null)
                setTransferDialog({
                  resource: { type: 'folder', folder: f },
                  mode: 'move',
                  targetFolderId: f.parentId ?? null,
                  error: '',
                })
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Mover / Copiar
            </button>
            <button
              onClick={() => {
                const f = folderContextMenu.folder
                setFolderContextMenu(null)
                handleToggleFavorite('FOLDER', f.id)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground"
            >
              <Star
                className={clsx(
                  'w-4 h-4',
                  (isLocalFavorite('FOLDER', folderContextMenu.folder.id) ?? false) && 'fill-current text-amber-500'
                )}
              />
              {(isLocalFavorite('FOLDER', folderContextMenu.folder.id) ?? false) ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            </button>
            {canAdminMaster && (() => {
              const isMaster = project?.docMaestroCarpetaId != null && String(project.docMaestroCarpetaId).toLowerCase() === String(folderContextMenu.folder.id).toLowerCase()
              return (
                <>
                  <div className="my-1 border-t border-border/60" />
                  {isMaster ? (
                    <button
                      onClick={() => {
                        setFolderContextMenu(null)
                        setShowConfirmClearMaster(true)
                      }}
                      disabled={clearMasterMutation.isPending}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-status-blocked/10 text-status-blocked disabled:opacity-50"
                    >
                      {clearMasterMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Quitar de documento maestro
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const f = folderContextMenu.folder
                        setFolderContextMenu(null)
                        designateMasterMutation.mutate({ resourceType: 'FOLDER', resourceId: f.id })
                      }}
                      disabled={designateMasterMutation.isPending}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground disabled:opacity-50"
                    >
                      {designateMasterMutation.isPending ? (
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
                const f = folderContextMenu.folder
                setFolderContextMenu(null)
                setConfirmDeleteFolder(f)
              }}
              disabled={deleteFolderMutation.isPending}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-status-blocked/15 text-status-blocked disabled:opacity-50"
            >
              {deleteFolderMutation.variables === folderContextMenu.folder.id &&
              deleteFolderMutation.isPending ? (
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
      )}

      {fileContextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setFileContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault()
              setFileContextMenu(null)
            }}
          />
          <div
            ref={fileCtxRef}
            className="fixed z-50 w-52 card p-1 text-sm shadow-2xl overflow-y-auto"
            style={{
              left: ctxClamp.file?.left ?? fileContextMenu.x,
              top: ctxClamp.file?.top ?? fileContextMenu.y,
              maxHeight: ctxClamp.file?.maxH ? `${ctxClamp.file.maxH}px` : undefined,
            }}
          >
            <button
              onClick={() => {
                const f = fileContextMenu.file
                setFileContextMenu(null)
                if (f.downloadUrl) {
                  window.open(f.downloadUrl, '_blank', 'noopener,noreferrer')
                }
              }}
              disabled={!fileContextMenu.file.downloadUrl}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              Abrir / Descargar
            </button>
            <button
              onClick={() => {
                const f = fileContextMenu.file
                setFileContextMenu(null)
                setRenameFile(f)
                const extIdx = f.name.lastIndexOf('.')
                const base = extIdx > 0 ? f.name.slice(0, extIdx) : f.name
                setRenameFileName(base)
                setRenameFileError('')
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground"
            >
              <Edit3 className="w-4 h-4" />
              Renombrar
            </button>
            <button
              onClick={() => {
                const f = fileContextMenu.file
                setFileContextMenu(null)
                setTransferDialog({
                  resource: { type: 'file', file: f },
                  mode: 'move',
                  targetFolderId: f.folderId ?? null,
                  error: '',
                })
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Mover / Copiar
            </button>
            <button
              onClick={() => {
                const f = fileContextMenu.file
                setFileContextMenu(null)
                setCommentFile(f)
                setCommentContent('')
                setCommentError('')
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground"
            >
              <MessageCircle className="w-4 h-4" />
              Comentar
            </button>
            <button
              onClick={() => {
                const f = fileContextMenu.file
                setFileContextMenu(null)
                handleToggleFavorite('FILE', f.id)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground"
            >
              <Star
                className={clsx(
                  'w-4 h-4',
                  (isLocalFavorite('FILE', fileContextMenu.file.id) ?? false) && 'fill-current text-amber-500'
                )}
              />
              {(isLocalFavorite('FILE', fileContextMenu.file.id) ?? false) ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            </button>
            {canAdminMaster && (() => {
              const isMaster = project?.docMaestroArchivoId != null && String(project.docMaestroArchivoId).toLowerCase() === String(fileContextMenu.file.id).toLowerCase()
              return (
                <>
                  <div className="my-1 border-t border-border/60" />
                  {isMaster ? (
                    <button
                      onClick={() => {
                        setFileContextMenu(null)
                        setShowConfirmClearMaster(true)
                      }}
                      disabled={clearMasterMutation.isPending}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-status-blocked/10 text-status-blocked disabled:opacity-50"
                    >
                      {clearMasterMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Quitar de documento maestro
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const f = fileContextMenu.file
                        setFileContextMenu(null)
                        designateMasterMutation.mutate({ resourceType: 'FILE', resourceId: f.id })
                      }}
                      disabled={designateMasterMutation.isPending}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground disabled:opacity-50"
                    >
                      {designateMasterMutation.isPending ? (
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
                const f = fileContextMenu.file
                setFileContextMenu(null)
                setConfirmDeleteFile(f)
              }}
              disabled={deleteFileMutation.isPending}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-status-blocked/15 text-status-blocked disabled:opacity-50"
            >
              {deleteFileMutation.variables === fileContextMenu.file.id &&
              deleteFileMutation.isPending ? (
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
      )}

      {docsAreaContextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setDocsAreaContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault()
              setDocsAreaContextMenu(null)
            }}
          />
          {(() => {
            const MENU_W = 220
            const MENU_H = 108
            const x = Math.min(
              Math.max(4, docsAreaContextMenu.x),
              window.innerWidth - MENU_W - 4
            )
            const y = Math.min(
              Math.max(4, docsAreaContextMenu.y),
              window.innerHeight - MENU_H - 4
            )
            return (
              <div
                className="fixed z-50 w-56 card p-1 text-sm shadow-2xl"
                style={{ left: x, top: y }}
              >
                <button
                  onClick={() => {
                    setDocsAreaContextMenu(null)
                    setNewFolderName('')
                    setNewFolderError('')
                    setShowNewFolder(true)
                  }}
                  disabled={!project || createFolderMutation.isPending}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground disabled:opacity-50"
                >
                  <FolderPlus className="w-4 h-4" />
                  Crear carpeta
                </button>
                <button
                  onClick={() => {
                    setDocsAreaContextMenu(null)
                    fileInputRef.current?.click()
                  }}
                  disabled={isUploading || uploadMutation.isPending}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-secondary text-foreground disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  Subir archivo
                </button>
              </div>
            )
          })()}
        </>
      )}

      {showDeleteProject && project && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-status-blocked/15 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-status-blocked" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-foreground">Mover proyecto a papelera</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    ¿Estás seguro que deseas eliminar{' '}
                    <strong className="text-foreground">{project.name}</strong>? La acción se puede
                    deshacer desde la papelera.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
              <button
                className="btn-secondary text-sm"
                onClick={() => setShowDeleteProject(false)}
                disabled={deleteMutation.isPending}
              >
                Cancelar
              </button>
              <button
                className="btn-primary text-sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Eliminando…
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Sí, eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForbiddenDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowForbiddenDelete(false)}
        >
          <div className="card w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-status-blocked/15 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5 text-status-blocked" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-foreground">Acceso Denegado</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    No tienes permisos para eliminar este proyecto. Solo el <strong>propietario</strong> del proyecto puede enviarlo a la papelera.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
              <button
                className="btn-primary text-sm"
                onClick={() => setShowForbiddenDelete(false)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirmDeleteFile(null)}
        >
          <div className="card w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-status-blocked/15 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-status-blocked" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-foreground">Eliminar archivo</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    ¿Eliminar definitivamente el archivo{' '}
                    <strong className="text-foreground">{confirmDeleteFile.name}</strong>? Esta
                    acción no se puede deshacer.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
              <button
                className="btn-secondary text-sm"
                onClick={() => setConfirmDeleteFile(null)}
                disabled={deleteFileMutation.isPending}
              >
                Cancelar
              </button>
              <button
                className="btn-primary text-sm"
                onClick={() => {
                  deleteFileMutation.mutate(confirmDeleteFile.id)
                  setConfirmDeleteFile(null)
                }}
                disabled={deleteFileMutation.isPending}
              >
                {deleteFileMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Eliminando…
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Sí, eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteFolder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirmDeleteFolder(null)}
        >
          <div className="card w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-status-blocked/15 flex items-center justify-center shrink-0">
                  <Folder className="w-5 h-5 text-status-blocked" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-foreground">Eliminar carpeta</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    ¿Eliminar la carpeta{' '}
                    <strong className="text-foreground">{confirmDeleteFolder.name}</strong>? Se
                    eliminarán también todos los archivos y subcarpetas que contenga. Esta acción no
                    se puede deshacer.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
              <button
                className="btn-secondary text-sm"
                onClick={() => setConfirmDeleteFolder(null)}
                disabled={deleteFolderMutation.isPending}
              >
                Cancelar
              </button>
              <button
                className="btn-primary text-sm"
                onClick={() => {
                  deleteFolderMutation.mutate(confirmDeleteFolder.id)
                  setConfirmDeleteFolder(null)
                }}
                disabled={deleteFolderMutation.isPending}
              >
                {deleteFolderMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Eliminando…
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Sí, eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRemoveMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirmRemoveMember(null)}
        >
          <div className="card w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-status-blocked/15 flex items-center justify-center shrink-0">
                  <UserMinus className="w-5 h-5 text-status-blocked" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-foreground">Retirar miembro</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    ¿Retirar a{' '}
                    <strong className="text-foreground">
                      {confirmRemoveMember.fullName || confirmRemoveMember.email || 'este usuario'}
                    </strong>{' '}
                    del proyecto? Perderá acceso inmediatamente.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
              <button
                className="btn-secondary text-sm"
                onClick={() => setConfirmRemoveMember(null)}
                disabled={removeMemberMutation.isPending}
              >
                Cancelar
              </button>
              <button
                className="btn-primary text-sm"
                onClick={() => {
                  if (!confirmRemoveMember) return
                  removeMemberMutation.mutate(confirmRemoveMember.id, {
                    onSettled: () => setConfirmRemoveMember(null),
                  })
                }}
                disabled={removeMemberMutation.isPending}
              >
                {removeMemberMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Retirando…
                  </>
                ) : (
                  <>
                    <UserMinus className="w-4 h-4" />
                    Sí, retirar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showInviteMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => {
            if (addMemberMutation.isPending) return
            setShowInviteMember(false)
          }}
        >
          <form
            onSubmit={handleAddMemberSubmit}
            className="card w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-brand-500" />
                  Agregar miembro al proyecto
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Selecciona un usuario de la organización.
                </p>
              </div>
              <button
                type="button"
                disabled={addMemberMutation.isPending}
                onClick={() => setShowInviteMember(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-secondary"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {(() => {
                const msg: string | null = inviteError
                  ? inviteError
                  : addMemberMutation.error instanceof Error
                    ? addMemberMutation.error.message
                    : addMemberMutation.error
                      ? 'Error desconocido'
                      : null
                if (!msg) return null
                return (
                  <div className="text-xs rounded-md p-2.5 bg-status-blocked/15 border border-status-blocked/40 text-destructive/90">
                    {msg}
                  </div>
                )
              })()}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Buscar usuario
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    autoFocus
                    type="text"
                    value={inviteSearch}
                    onChange={(e) => {
                      setInviteSearch(e.target.value)
                      setInviteSelectedUserId(null)
                    }}
                    placeholder="Nombre o correo del usuario..."
                    className="input-base w-full pl-8 pr-2.5 text-[12px] h-9 rounded-md border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Rol en el proyecto
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="input-base w-full text-[12px] h-9 rounded-md border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 bg-surface"
                >
                  <option value="Miembro">Miembro</option>
                  <option value="Colaborador">Colaborador</option>
                  <option value="Editor">Editor</option>
                  <option value="Administrador">Administrador</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Usuarios disponibles
                </label>
                <div className="max-h-[260px] overflow-y-auto scrollbar-thin card divide-y divide-border overflow-hidden">
                  {orgMembersQuery.isLoading && orgMembersQuery.fetchStatus !== 'idle' ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="p-3 flex items-center gap-3 animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-surface-secondary" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-40 bg-surface-secondary rounded" />
                          <div className="h-2.5 w-56 bg-surface-secondary rounded" />
                        </div>
                      </div>
                    ))
                  ) : candidateOrgMembers.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-xs">
                      {inviteSearch.trim()
                        ? 'No se encontraron usuarios con esos términos.'
                        : 'Todos los miembros de la organización ya están en este proyecto.'}
                    </div>
                  ) : (
                    candidateOrgMembers.map((u) => {
                      const selected = inviteSelectedUserId === u.id
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setInviteSelectedUserId(u.id)}
                          className={clsx(
                            'w-full p-3 flex items-center gap-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/60',
                            selected
                              ? 'bg-brand-500/12 ring-1 ring-inset ring-brand-500/30'
                              : 'hover:bg-surface-secondary'
                          )}
                        >
                          <div className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center text-xs font-semibold shrink-0">
                            {initials(u.fullName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] font-medium text-foreground truncate">
                              {u.fullName || 'Usuario sin nombre'}
                            </div>
                            <div className="text-[10.5px] text-gray-400 truncate">
                              {u.email || 'Sin correo'}
                            </div>
                          </div>
                          <div
                            className={clsx(
                              'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                              selected
                                ? 'bg-brand-500 border-brand-500 text-white'
                                : 'border-muted-foreground/30'
                            )}
                          >
                            {selected && <Check className="w-3 h-3" />}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={addMemberMutation.isPending}
                onClick={() => {
                  setShowInviteMember(false)
                  setInviteSelectedUserId(null)
                  setInviteSearch('')
                  setInviteError('')
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary text-sm"
                disabled={!inviteSelectedUserId || addMemberMutation.isPending}
              >
                {addMemberMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Agregando…
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Agregar miembro
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {pageToast && (
        <div className="fixed top-4 right-4 z-[60] max-w-sm w-full">
          <div
            className={clsx(
              'card shadow-lg border flex items-start gap-3 p-4 pr-12 animate-in fade-in slide-in-from-right-4',
              pageToast.kind === 'error'
                ? 'border-status-blocked/40 bg-status-blocked/10'
                : 'border-status-approved/40 bg-status-approved/10'
            )}
            role="status"
            aria-live="polite"
          >
            <div
              className={clsx(
                'w-10 h-10 rounded-xl shrink-0 flex items-center justify-center',
                pageToast.kind === 'error'
                  ? 'bg-status-blocked/15 text-status-blocked'
                  : 'bg-status-approved/15 text-status-approved'
              )}
            >
              {pageToast.kind === 'error' ? (
                <XCircle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h4 className="font-semibold text-sm text-foreground">{pageToast.title}</h4>
              <p className="text-xs text-muted-foreground dark:text-slate-300 mt-1 break-words">
                {pageToast.message}
              </p>
            </div>
            <button
              className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground"
              onClick={() => setPageToast(null)}
              aria-label="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FolderTreeItem({
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

function TransferTargetTreeItem({
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
          <span className="w-3.5 h-3.5 shrink-0" />
        )}
        <Folder className={clsx('w-4 h-4 shrink-0 text-status-review', isDisabled && 'opacity-50')} />
        <span className="truncate">{node.name}</span>
      </button>
      {open &&
        node.children.map((c) => (
          <TransferTargetTreeItem
            key={c.id}
            node={c}
            depth={depth + 1}
            disabledFolderIds={disabledFolderIds}
            selectedTargetFolderId={selectedTargetFolderId}
            onSelect={onSelect}
          />
        ))}
    </>
  )
}

export default ProjectDetailPage
