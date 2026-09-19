import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  FileText,
  MessageSquare,
  Calendar,
  Users,
  Compass,
  FileCheck2,
  Clock,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUIStore } from '@/store/uiStore'
import type { SelectedResourceType } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import ProjectTeamTab from '../components/project/ProjectTeamTab'
import ProjectMasterTab from '../components/project/ProjectMasterTab'
import ProjectMeetingsTab from '../components/project/ProjectMeetingsTab'
import ProjectDocsTab from '../components/project/ProjectDocsTab'
import ProjectHeader from '../components/project/ProjectHeader'
import ProjectPageToast from '../components/project/ProjectPageToast'
import ProjectConfirmDeleteFileDialog from '../components/project/ProjectConfirmDeleteFileDialog'
import {
  DeleteProjectDialog,
  ForbiddenDeleteDialog,
  EditProjectModal,
} from '../components/project/ProjectProjectModals'
import {
  RenameFolderModal,
  ConfirmDeleteFolderDialog,
} from '../components/project/ProjectFolderModals'
import ProjectNewFolderModal from '../components/project/ProjectNewFolderModal'
import {
  MasterSelectorModal,
  ConfirmClearMasterDialog,
} from '../components/project/ProjectMasterModals'
import {
  ConfirmRemoveMemberDialog,
  InviteMemberModal,
} from '../components/project/ProjectMemberModals'
import {
  NewMeetingModal,
  ConfirmDeleteMeetingDialog,
} from '../components/project/ProjectMeetingDialogs'
import ProjectFilePickerModal, { type PickerMode } from '../components/project/ProjectFilePickerModal'
import {
  FolderContextMenu,
  FileContextMenu,
  DocsAreaContextMenu,
} from '../components/project/ProjectContextMenus'
import {
  RenameFileModal,
  CommentFileDialog,
  TransferDialog,
} from '../components/project/ProjectExtraModals'
import ProjectTopicsTab from '../components/project/ProjectTopicsTab'
import ProjectAportesTab from '../components/project/ProjectAportesTab'
import ProjectActivityTab from '../components/project/ProjectActivityTab'
import { useTopicForms } from '../components/project/project-topics/useTopicForms'
import { useTopicItemForms } from '../components/project/project-topics/useTopicItemForms'
import { useAporteForms } from '../components/project/project-aportes/useAporteForms'
import type {
  ApiContributionPriority,
  ApiContributionStatus,
  ApiContributionType,
  ApiProjectContribution,
  CreateContributionPayload,
  UpdateContributionPayload,
} from '../services/aportes.service'
import {
  aportesQueryKeys,
  createContribution as apiCreateContribution,
  deleteContribution as apiDeleteContribution,
  fetchContributions as apiFetchContributions,
  fetchLinkedTopics as apiFetchLinkedTopics,
  linkTopic as apiLinkAporteTopic,
  unlinkTopic as apiUnlinkAporteTopic,
  updateContribution as apiUpdateContribution,
} from '../services/aportes.service'
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
  type DesignateMasterDocPayload,
} from '../services/projects.service'
import {
  toggleFavorite,
  type FavoriteResourceType,
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
  type ApiFile,
  commentFile as apiCommentFile,
  copyFile,
  deleteFile,
  fetchFiles,
  moveFile,
  updateFile,
  uploadFile,
} from '../services/files.service'
import {
  ApiMeeting,
  ApiMeetingStatus,
  CreateMeetingPayload,
  UpdateMeetingPayload,
  createMeeting as apiCreateMeeting,
  deleteMeeting as apiDeleteMeeting,
  fetchMeetingLinkedTopics as apiFetchMeetingLinkedTopics,
  fetchMeetings,
  linkTopicToMeeting as apiLinkTopicToMeeting,
  unlinkTopicFromMeeting as apiUnlinkTopicFromMeeting,
  updateMeeting as apiUpdateMeeting,
} from '../services/meetings.service'
import {
  ApiTopic,
  ApiTopicItem,
  ApiTopicItemFile,
  ApiTopicItemStatus,
  ApiTopicStatus,
  CreateTopicItemPayload,
  CreateTopicPayload,
  UpdateTopicItemPayload,
  UpdateTopicPayload,
  assignMemberToTopicItem,
  createTopic as apiCreateTopic,
  createTopicItem as apiCreateTopicItem,
  deleteTopic as apiDeleteTopic,
  deleteTopicItem as apiDeleteTopicItem,
  fetchAvailableMembersForItem,
  fetchTopicItemFiles,
  fetchTopicItems,
  fetchTopics,
  linkFileToTopicItem,
  unassignMemberFromTopicItem,
  unlinkFileFromTopicItem,
  updateTopic as apiUpdateTopic,
  updateTopicItem as apiUpdateTopicItem,
} from '../services/project-topics.service'
import {
  fetchMeetingParticipants,
  upsertMeetingParticipant,
  setMeetingAttendance,
  removeMeetingParticipant,
  setMeetingMinutesFile as apiSetMeetingMinutesFile,
} from '../services/meeting-details.service'

const tabs = [
  { id: 'docs', label: 'Documentos', icon: FileText },
  { id: 'topics', label: 'Temas', icon: MessageSquare },
  { id: 'meetings', label: 'Reuniones', icon: Calendar },
  { id: 'contributions', label: 'Aportes', icon: Compass },
  { id: 'master', label: 'Documento maestro', icon: FileCheck2 },
  { id: 'activity', label: 'Actividad', icon: Clock },
  { id: 'team', label: 'Equipo', icon: Users },
]

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
  const [showForbiddenDelete, setShowForbiddenDelete] = useState<{
    open: boolean
    scope?: 'project' | 'file'
    fileName?: string | null
    ownerFullName?: string | null
    ownerEmail?: string | null
    requesterFullName?: string | null
  }>({ open: false })
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
  const [meetingsPage, setMeetingsPage] = useState(1)
  const meetingsPageSize = 20
  const [meetingsSearch, setMeetingsSearch] = useState('')
  const [meetingsStatusFilter, setMeetingsStatusFilter] = useState<ApiMeetingStatus | ''>('')
  const [showNewMeeting, setShowNewMeeting] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState<ApiMeeting | null>(null)
  const [newMeetingForm, setNewMeetingForm] = useState<CreateMeetingPayload & { errors: Record<string, string> }>({
    title: '',
    description: null,
    meetingAt: null,
    status: 'SCHEDULED',
    errors: {},
  })
  const [confirmDeleteMeeting, setConfirmDeleteMeeting] = useState<ApiMeeting | null>(null)
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null)
  const [linkingTopicsForMeetingId, setLinkingTopicsForMeetingId] = useState<string | null>(null)
  const [meetingPanelTab, setMeetingPanelTab] = useState<'participants' | 'file'>('participants')
  const [showAddMeetingParticipant, setShowAddMeetingParticipant] = useState<string | null>(null)
  const [newParticipantUserId, setNewParticipantUserId] = useState('')
  const [newParticipantRole, setNewParticipantRole] = useState('')
  const [newParticipantAttended, setNewParticipantAttended] = useState(false)
  const [showFilePicker, setShowFilePicker] = useState(false)
  const [filePickerMode, setFilePickerMode] = useState<PickerMode>('meeting')
  const [filePickerSearch, setFilePickerSearch] = useState('')
  const [linkingTopicItemId, setLinkingTopicItemId] = useState<string | null>(null)
  const [itemFilesCache, setItemFilesCache] = useState<Map<string, ApiTopicItemFile[]>>(new Map())
  const [itemFilesLoading, setItemFilesLoading] = useState<Set<string>>(new Set())
  const [itemFilesError, setItemFilesError] = useState<Map<string, string>>(new Map())
  const [highlightFileId, setHighlightFileId] = useState<string | null>(null)
  const [forceExpandFolderIds, setForceExpandFolderIds] = useState<Set<string> | null>(null)
  const [removeMeetingFileId, setRemoveMeetingFileId] = useState<string | null>(null)
  const [topicsPage, setTopicsPage] = useState(1)
  const topicsPageSize = 20
  const [topicsSearch, setTopicsSearch] = useState('')
  const [topicsStatusFilter, setTopicsStatusFilter] = useState<ApiTopicStatus | ''>('')
  const topicForms = useTopicForms()

  const [aporteSearch, setAporteSearch] = useState('')
  const [aporteTipoFilter, setAporteTipoFilter] = useState<ApiContributionType | ''>('')
  const [aporteEstadoFilter, setAporteEstadoFilter] = useState<ApiContributionStatus | ''>('')
  const [aporteImportanciaFilter, setAporteImportanciaFilter] = useState<ApiContributionPriority | ''>('')
  const [aporteOffset, setAporteOffset] = useState(0)
  const aporteLimit = 20
  const aporteForms = useAporteForms()

  const topicItemsPage = 1
  const topicItemsPageSize = 200
  const [topicItemsSearch, setTopicItemsSearch] = useState('')
  const [topicItemsStatusFilter, setTopicItemsStatusFilter] = useState<ApiTopicItemStatus | ''>('')
  const topicItemForms = useTopicItemForms()
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

  function handleSelectResourceOrTogglePanel(r: { type: 'file' | 'folder'; id: string }) {
    const isSame =
      selectedResource &&
      selectedResource.type === r.type &&
      selectedResource.id === r.id &&
      selectedResource.projectId === projectId
    if (isSame) {
      toggleRightPanel()
    } else {
      setSelectedResource({ ...r, projectId })
      if (!rightPanelOpen) toggleRightPanel()
    }
  }

  const detail = projectQuery.data
  const project = detail?.project
  const stats = detail?.stats
  const headerBadge = project ? statusBadgeInfo(project.status) : null

  const visibleFoldersCurrentLevel = useMemo<ApiFolder[]>(() => {
    if (!foldersQuery.data?.items) return []
    return foldersQuery.data.items.filter((f) => {
      if (selectedFolderId === null || selectedFolderId === undefined) return f.parentId === null || f.parentId === undefined
      return f.parentId === selectedFolderId
    })
  }, [foldersQuery.data, selectedFolderId])

  const breadcrumbChain = useMemo<ApiFolder[]>(() => {
    if (selectedFolderId === null || selectedFolderId === undefined) return []
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

  const meetingsQuery = useQuery({
    queryKey: [
      'project',
      'meetings',
      projectId,
      {
        page: meetingsPage,
        pageSize: meetingsPageSize,
        search: meetingsSearch.trim(),
        status: meetingsStatusFilter || undefined,
      },
    ],
    queryFn: () =>
      fetchMeetings({
        projectId,
        page: meetingsPage,
        pageSize: meetingsPageSize,
        search: meetingsSearch.trim() || undefined,
        status: meetingsStatusFilter || undefined,
      }),
    enabled: Boolean(projectId),
    staleTime: 30_000,
    retry: 1,
  })

  const meetingParticipantsQuery = useQuery({
    queryKey: ['project', 'meeting', 'participants', projectId, expandedMeetingId],
    queryFn: () =>
      fetchMeetingParticipants({
        projectId,
        meetingId: expandedMeetingId as string,
        pageSize: 200,
      }),
    enabled: Boolean(projectId) && Boolean(expandedMeetingId) && meetingPanelTab === 'participants',
    staleTime: 20_000,
    retry: 1,
  })

  const meetingFilesQuery = useQuery({
    queryKey: ['project', 'meeting', 'file-picker', 'files', projectId, filePickerSearch.trim()],
    queryFn: async () => {
      const page = await fetchFiles({
        projectId,
        folderId: 'all',
        page: 1,
        pageSize: 500,
        search: filePickerSearch.trim() || undefined,
      })
      return page.items
    },
    enabled: Boolean(projectId) && (showFilePicker || Boolean(expandedMeetingId && meetingPanelTab === 'file') || Boolean(linkingTopicItemId)),
    staleTime: 60_000,
  })

  const masterFilesQuery = useQuery<PaginatedData<ApiFile>>({
    queryKey: ['project', 'master-selector', 'files', projectId],
    queryFn: () =>
      fetchFiles({
        projectId,
        folderId: 'all',
        page: 1,
        pageSize: 500,
      }),
    enabled: Boolean(projectId) && showMasterSelector,
    staleTime: 60_000,
    retry: 1,
  })

  const topicsQuery = useQuery({
    queryKey: [
      'project',
      'topics',
      projectId,
      {
        page: topicsPage,
        pageSize: topicsPageSize,
        search: topicsSearch.trim(),
        status: topicsStatusFilter || undefined,
      },
    ],
    queryFn: () =>
      fetchTopics({
        projectId,
        page: topicsPage,
        pageSize: topicsPageSize,
        search: topicsSearch.trim() || undefined,
        status: topicsStatusFilter || undefined,
      }),
    enabled: Boolean(projectId),
    staleTime: 30_000,
    retry: 1,
  })

  const topicItemsQuery = useQuery({
    queryKey: [
      'project',
      'topic',
      'items',
      projectId,
      topicItemForms.state.expandedTopicId,
      {
        page: topicItemsPage,
        pageSize: topicItemsPageSize,
        search: topicItemsSearch.trim(),
        status: topicItemsStatusFilter || undefined,
      },
    ],
    queryFn: () =>
      fetchTopicItems({
        projectId,
        topicId: topicItemForms.state.expandedTopicId as string,
        page: topicItemsPage,
        pageSize: topicItemsPageSize,
        search: topicItemsSearch.trim() || undefined,
        status: topicItemsStatusFilter || undefined,
      }),
    enabled: Boolean(projectId) && Boolean(topicItemForms.state.expandedTopicId),
    staleTime: 20_000,
    retry: 1,
  })

  const topicItemAvailableMembersQuery = useQuery({
    queryKey: ['project', 'topic', 'item', 'available-members', projectId, topicItemForms.state.expandedTopicId, topicItemForms.memberState.managingMembersForItemId],
    queryFn: () =>
      fetchAvailableMembersForItem(projectId, topicItemForms.state.expandedTopicId as string, topicItemForms.memberState.managingMembersForItemId as string),
    enabled: Boolean(projectId) && Boolean(topicItemForms.state.expandedTopicId) && Boolean(topicItemForms.memberState.managingMembersForItemId),
    staleTime: 10_000,
    retry: 1,
  })

  const aportesQuery = useQuery({
    queryKey: aportesQueryKeys.list(projectId, {
      tipo: aporteTipoFilter || undefined,
      estado: aporteEstadoFilter || undefined,
      importancia: aporteImportanciaFilter || undefined,
      search: aporteSearch.trim() || undefined,
      limit: aporteLimit,
      offset: aporteOffset,
    }),
    queryFn: () =>
      apiFetchContributions({
        projectId,
        tipo: aporteTipoFilter || null,
        estado: aporteEstadoFilter || null,
        importancia: aporteImportanciaFilter || null,
        search: aporteSearch.trim() || null,
        limit: aporteLimit,
        offset: aporteOffset,
      }),
    enabled: Boolean(projectId),
    staleTime: 30_000,
    retry: 1,
  })

  const aporteLinkedTopicsQuery = useQuery({
    queryKey: aportesQueryKeys.linkedTopics(projectId, aporteForms.state.showLinkTopicModal?.aporteId ?? ''),
    queryFn: () =>
      apiFetchLinkedTopics(projectId, aporteForms.state.showLinkTopicModal?.aporteId as string),
    enabled: Boolean(projectId) && Boolean(aporteForms.state.showLinkTopicModal?.aporteId),
    staleTime: 15_000,
    retry: 1,
  })

  const detailIsLoading = projectQuery.isLoading && projectQuery.fetchStatus !== 'idle'
  const detailIs404 = projectQuery.isError && (projectQuery.error as any)?.message?.toLowerCase().includes('no encontrado')
  const redirectNoProject = !projectId
  const redirectNotFound = !!detailIs404

  const invalidateDetail = () => {
    queryClient.invalidateQueries({ queryKey: ['project', 'detail', projectId] })
    queryClient.invalidateQueries({ queryKey: ['project', 'members', projectId] })
    queryClient.invalidateQueries({ queryKey: ['project', 'folders', projectId] })
    queryClient.invalidateQueries({ queryKey: ['project', 'files', projectId], exact: false })
    queryClient.invalidateQueries({ queryKey: ['project', 'meetings', projectId] })
    queryClient.invalidateQueries({ queryKey: ['project', 'topics', projectId] })
    queryClient.invalidateQueries({ queryKey: aportesQueryKeys.all(projectId) })
    if (expandedMeetingId) {
      queryClient.invalidateQueries({ queryKey: ['project', 'meeting', 'participants', projectId, expandedMeetingId] })
    }
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
        setShowForbiddenDelete({ open: true, scope: 'project', requesterFullName: authUser?.fullName ?? null })
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

  const canEditMeetings = useMemo(() => {
    if (!project?.ownerId || !authUser?.id) return false
    if (authUser.isOrgAdmin) return true
    return String(project.ownerId).toLowerCase() === String(authUser.id).toLowerCase()
  }, [project, authUser])

  const canDeleteMeetings = useMemo(() => {
    if (!project?.ownerId || !authUser?.id) return false
    if (authUser.isOrgAdmin) return true
    return String(project.ownerId).toLowerCase() === String(authUser.id).toLowerCase()
  }, [project, authUser])

  const canEditTopics = useMemo(() => {
    if (!project?.ownerId || !authUser?.id) return false
    if (authUser.isOrgAdmin) return true
    return String(project.ownerId).toLowerCase() === String(authUser.id).toLowerCase()
  }, [project, authUser])

  const canDeleteTopics = useMemo(() => {
    if (!project?.ownerId || !authUser?.id) return false
    if (authUser.isOrgAdmin) return true
    return String(project.ownerId).toLowerCase() === String(authUser.id).toLowerCase()
  }, [project, authUser])

  const canCreateAportes = useMemo(() => {
    if (!project?.ownerId || !authUser?.id) return false
    if (authUser.isOrgAdmin) return true
    return String(project.ownerId).toLowerCase() === String(authUser.id).toLowerCase()
  }, [project, authUser])

  const canEditAportes = useMemo(() => {
    if (!project?.ownerId || !authUser?.id) return false
    if (authUser.isOrgAdmin) return true
    return String(project.ownerId).toLowerCase() === String(authUser.id).toLowerCase()
  }, [project, authUser])

  const canDeleteAportes = useMemo(() => {
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

  const openNewMeeting = () => {
    setNewMeetingForm({
      title: '',
      description: null,
      meetingAt: null,
      status: 'SCHEDULED',
      errors: {},
    })
    setEditingMeeting(null)
    setShowNewMeeting(true)
  }

  const openEditMeeting = (meeting: ApiMeeting) => {
    setEditingMeeting(meeting)
    setNewMeetingForm({
      title: meeting.title,
      description: meeting.description ?? null,
      meetingAt: meeting.meetingAt ?? null,
      status: meeting.status,
      errors: {},
    })
    setShowNewMeeting(true)
  }

  const createMeetingMutation = useMutation({
    mutationFn: (payload: CreateMeetingPayload) => apiCreateMeeting(projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'meetings', projectId] })
      invalidateDetail()
      setShowNewMeeting(false)
      setEditingMeeting(null)
      setPageToast({
        kind: 'success',
        title: 'Reunión creada',
        message: 'La reunión se registró correctamente en el proyecto.',
      })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setNewMeetingForm((prev) => ({ ...prev, errors: { _global: msg } }))
    },
  })

  const updateMeetingMutation = useMutation({
    mutationFn: (payload: { meetingId: string; patch: UpdateMeetingPayload }) =>
      apiUpdateMeeting(projectId, payload.meetingId, payload.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'meetings', projectId] })
      invalidateDetail()
      setShowNewMeeting(false)
      setEditingMeeting(null)
      setPageToast({
        kind: 'success',
        title: 'Reunión actualizada',
        message: 'Se guardaron los cambios de la reunión.',
      })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setNewMeetingForm((prev) => ({ ...prev, errors: { _global: msg } }))
    },
  })

  const deleteMeetingMutation = useMutation({
    mutationFn: (meetingId: string) => apiDeleteMeeting(projectId, meetingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'meetings', projectId] })
      invalidateDetail()
      setConfirmDeleteMeeting(null)
      setPageToast({
        kind: 'success',
        title: 'Reunión eliminada',
        message: 'La reunión se retiró del proyecto.',
      })
    },
    onError: (err: any) => {
      setPageToast({
        kind: 'error',
        title: 'No se pudo eliminar la reunión',
        message:
          err?.response?.data?.message ||
          err?.message ||
          'Error desconocido. Inténtalo de nuevo.',
      })
    },
  })

  const handleSubmitMeeting = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    const title = newMeetingForm.title.trim()
    if (title.length === 0) errors.title = 'El título es obligatorio'
    else if (title.length > 255) errors.title = 'Máximo 255 caracteres'
    if (newMeetingForm.meetingAt) {
      const d = new Date(newMeetingForm.meetingAt)
      if (Number.isNaN(d.getTime())) errors.meetingAt = 'Fecha inválida'
    }
    setNewMeetingForm((prev) => ({ ...prev, errors }))
    if (Object.keys(errors).length) return
    const payload: CreateMeetingPayload = {
      title,
      description: newMeetingForm.description ?? null,
      meetingAt: newMeetingForm.meetingAt ?? null,
      status: newMeetingForm.status,
    }
    if (editingMeeting) {
      updateMeetingMutation.mutate({ meetingId: editingMeeting.id, patch: payload })
    } else {
      createMeetingMutation.mutate(payload)
    }
  }

  const createTopicMutation = useMutation({
    mutationFn: (payload: CreateTopicPayload) => apiCreateTopic(projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'topics', projectId] })
      invalidateDetail()
      topicForms.closeTopicForm()
      setPageToast({ kind: 'success', title: 'Tema creado', message: 'El tema se registró correctamente en el proyecto.' })
    },
    onError: (err: unknown) => {
      topicForms.state.formNew.setError(err instanceof Error ? err.message : 'Error desconocido')
    },
  })

  const updateTopicMutation = useMutation({
    mutationFn: (payload: { topicId: string; patch: UpdateTopicPayload }) =>
      apiUpdateTopic(projectId, payload.topicId, payload.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'topics', projectId] })
      invalidateDetail()
      topicForms.closeTopicForm()
      setPageToast({ kind: 'success', title: 'Tema actualizado', message: 'Se guardaron los cambios del tema.' })
    },
    onError: (err: unknown) => {
      topicForms.state.formEdit.setError(err instanceof Error ? err.message : 'Error desconocido')
    },
  })

  const deleteTopicMutation = useMutation({
    mutationFn: (topicId: string) => apiDeleteTopic(projectId, topicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'topics', projectId] })
      invalidateDetail()
      topicForms.state.setConfirmDeleteTopic(null)
      topicItemForms.state.setExpandedTopicId((prev) => prev === (topicForms.state.confirmDeleteTopic?.id ?? null) ? null : prev)
      setPageToast({ kind: 'success', title: 'Tema eliminado', message: 'El tema se retiró del proyecto.' })
    },
    onError: (err: any) => {
      setPageToast({
        kind: 'error',
        title: 'No se pudo eliminar el tema',
        message: err?.response?.data?.message || err?.message || 'Error desconocido. Inténtalo de nuevo.',
      })
    },
  })

  const createContributionMutation = useMutation({
    mutationFn: (payload: CreateContributionPayload) => apiCreateContribution(projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aportesQueryKeys.all(projectId) })
      invalidateDetail()
      aporteForms.closeAporteForm()
      setPageToast({ kind: 'success', title: 'Aporte creado', message: 'El aporte se registró correctamente en el proyecto.' })
    },
    onError: (err: unknown) => {
      aporteForms.state.formNew.setError(err instanceof Error ? err.message : 'Error desconocido')
    },
  })

  const updateContributionMutation = useMutation({
    mutationFn: (payload: { aporteId: string; patch: UpdateContributionPayload }) =>
      apiUpdateContribution(projectId, payload.aporteId, payload.patch),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: aportesQueryKeys.all(projectId) })
      queryClient.invalidateQueries({ queryKey: aportesQueryKeys.detail(projectId, vars.aporteId) })
      invalidateDetail()
      aporteForms.closeAporteForm()
      setPageToast({ kind: 'success', title: 'Aporte actualizado', message: 'Se guardaron los cambios del aporte.' })
    },
    onError: (err: unknown) => {
      aporteForms.state.formEdit.setError(err instanceof Error ? err.message : 'Error desconocido')
    },
  })

  const deleteContributionMutation = useMutation({
    mutationFn: (contributionId: string) => apiDeleteContribution(projectId, contributionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aportesQueryKeys.all(projectId) })
      invalidateDetail()
      aporteForms.state.setConfirmDeleteAporte(null)
      setPageToast({ kind: 'success', title: 'Aporte eliminado', message: 'El aporte se retiró del proyecto.' })
    },
    onError: (err: any) => {
      setPageToast({
        kind: 'error',
        title: 'No se pudo eliminar el aporte',
        message: err?.response?.data?.message || err?.message || 'Error desconocido. Inténtalo de nuevo.',
      })
    },
  })

  const linkAporteTopicMutation = useMutation({
    mutationFn: (payload: { aporteId: string; topicId: string }) =>
      apiLinkAporteTopic(projectId, payload.aporteId, payload.topicId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: aportesQueryKeys.all(projectId) })
      queryClient.invalidateQueries({ queryKey: aportesQueryKeys.linkedTopics(projectId, vars.aporteId) })
      invalidateDetail()
      setPageToast({ kind: 'success', title: 'Tema vinculado', message: 'El tema se vinculó al aporte correctamente.' })
    },
    onError: (err: any) => {
      setPageToast({
        kind: 'error',
        title: 'No se pudo vincular el tema',
        message: err?.response?.data?.message || err?.message || 'Error desconocido.',
      })
    },
  })

  const unlinkAporteTopicMutation = useMutation({
    mutationFn: (payload: { aporteId: string; topicId: string }) =>
      apiUnlinkAporteTopic(projectId, payload.aporteId, payload.topicId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: aportesQueryKeys.all(projectId) })
      queryClient.invalidateQueries({ queryKey: aportesQueryKeys.linkedTopics(projectId, vars.aporteId) })
      invalidateDetail()
      setPageToast({ kind: 'success', title: 'Tema desvinculado', message: 'El tema se retiró del aporte.' })
    },
    onError: (err: any) => {
      setPageToast({
        kind: 'error',
        title: 'No se pudo desvincular el tema',
        message: err?.response?.data?.message || err?.message || 'Error desconocido.',
      })
    },
  })

  const openNewAporte = () => aporteForms.openNewAporte()
  const openEditAporte = (a: ApiProjectContribution) => aporteForms.openEditAporte(a)

  const handleSubmitAporte = (e: React.FormEvent) => {
    e.preventDefault()
    if (aporteForms.state.editingAporte) {
      const payload = aporteForms.buildUpdatePayload()
      if (payload) updateContributionMutation.mutate(payload)
    } else {
      const payload = aporteForms.buildCreatePayload()
      if (payload) createContributionMutation.mutate(payload)
    }
  }

  const onConfirmDeleteAporte = () => {
    if (aporteForms.state.confirmDeleteAporte) {
      deleteContributionMutation.mutate(aporteForms.state.confirmDeleteAporte.id)
    }
  }

  const onSubmitLinkTopic = (topicId: string) => {
    if (aporteForms.state.showLinkTopicModal?.aporteId) {
      linkAporteTopicMutation.mutate({ aporteId: aporteForms.state.showLinkTopicModal.aporteId, topicId })
    }
  }

  const onUnlinkTopic = (aporteId: string, topicId: string) => {
    unlinkAporteTopicMutation.mutate({ aporteId, topicId })
  }

  const onSelectAttachedFile = async (file: File) => {
    const editing = !!aporteForms.state.editingAporte
    const form = editing ? aporteForms.state.formEdit : aporteForms.state.formNew
    if (form.uploading) return
    form.setUploading(true)
    form.setUploadPercent(0)
    form.setError('')
    try {
      const uploaded = await uploadFile({
        projectId,
        folderId: form.folderId ?? undefined,
        file,
        onProgress: (percent) => form.setUploadPercent(percent),
      })
      form.setAttachedFileId(uploaded.id)
      form.setAttachedFileMeta({
        id: uploaded.id,
        name: uploaded.name,
        sizeBytes: uploaded.sizeBytes,
        mimeType: uploaded.mimeType,
      })
      form.setUploadPercent(100)
    } catch (err: any) {
      form.setAttachedFileId(null)
      form.setAttachedFileMeta(null)
      form.setUploadPercent(0)
      form.setError(err?.response?.data?.message || err?.message || 'No se pudo subir el archivo adjunto')
    } finally {
      form.setUploading(false)
    }
  }

  const openMeetingFilePicker = () => {
    setFilePickerSearch('')
    setFilePickerMode('meeting')
    setShowFilePicker(true)
  }
  const openAporteFilePicker = () => {
    setFilePickerSearch('')
    setFilePickerMode('aporte')
    setShowFilePicker(true)
  }
  const openTopicItemFilePicker = (itemId: string) => {
    setLinkingTopicItemId(itemId)
    setFilePickerSearch('')
    setFilePickerMode('topic-item')
    setShowFilePicker(true)
  }
  const closeTopicItemFilePicker = () => {
    setLinkingTopicItemId(null)
    setFilePickerSearch('')
    setShowFilePicker(false)
  }
  const onClearAttachedFile = () => {
    const editing = !!aporteForms.state.editingAporte
    const form = editing ? aporteForms.state.formEdit : aporteForms.state.formNew
    form.setAttachedFileId(null)
    form.setAttachedFileMeta(null)
    form.setUploadPercent(0)
    form.setUploading(false)
    form.setError('')
  }
  const onPickExistingAttachedFile = (fileId: string, file: { name: string; sizeBytes?: number | null; mimeType?: string | null }) => {
    const editing = !!aporteForms.state.editingAporte
    const form = editing ? aporteForms.state.formEdit : aporteForms.state.formNew
    form.setAttachedFileId(fileId)
    form.setAttachedFileMeta({
      id: fileId,
      name: file.name,
      sizeBytes: file.sizeBytes ?? 0,
      mimeType: file.mimeType ?? null,
    })
    form.setError('')
  }

  const createTopicItemMutation = useMutation({
    mutationFn: (payload: CreateTopicItemPayload & { topicId: string }) =>
      apiCreateTopicItem(projectId, payload.topicId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'topic', 'items', projectId, topicItemForms.state.expandedTopicId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'topics', projectId] })
      invalidateDetail()
      topicItemForms.closeTopicItemForm()
      topicItemForms.resetNewTopicItemForm()
      setPageToast({ kind: 'success', title: 'Concepto creado', message: 'Se registró el concepto en el tema.' })
    },
    onError: (err: unknown) => {
      topicItemForms.state.formNew.setError(err instanceof Error ? err.message : 'Error desconocido')
    },
  })

  const updateTopicItemMutation = useMutation({
    mutationFn: (payload: { topicId: string; itemId: string; patch: UpdateTopicItemPayload }) =>
      apiUpdateTopicItem(projectId, payload.topicId, payload.itemId, payload.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'topic', 'items', projectId, topicItemForms.state.expandedTopicId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'topics', projectId] })
      invalidateDetail()
      topicItemForms.closeTopicItemForm()
      topicItemForms.resetEditTopicItemForm()
      setPageToast({ kind: 'success', title: 'Concepto actualizado', message: 'Se guardaron los cambios.' })
    },
    onError: (err: unknown) => {
      topicItemForms.state.formEdit.setError(err instanceof Error ? err.message : 'Error desconocido')
    },
  })

  const deleteTopicItemMutation = useMutation({
    mutationFn: (payload: { topicId: string; itemId: string }) =>
      apiDeleteTopicItem(projectId, payload.topicId, payload.itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'topic', 'items', projectId, topicItemForms.state.expandedTopicId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'topics', projectId] })
      invalidateDetail()
      topicItemForms.state.setConfirmDeleteTopicItem(null)
      topicItemForms.memberState.setManagingMembersForItemId((prev) => prev === topicItemForms.state.confirmDeleteTopicItem?.id ? null : prev)
      setPageToast({ kind: 'success', title: 'Concepto eliminado', message: 'El concepto se retiró del tema.' })
    },
    onError: (err: any) => {
      setPageToast({
        kind: 'error',
        title: 'No se pudo eliminar el concepto',
        message: err?.response?.data?.message || err?.message || 'Error desconocido. Inténtalo de nuevo.',
      })
    },
  })

  const assignItemMemberMutation = useMutation({
    mutationFn: (payload: { topicId: string; itemId: string; projectMemberId: string }) =>
      assignMemberToTopicItem(projectId, payload.topicId, payload.itemId, { projectMemberId: payload.projectMemberId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'topic', 'items', projectId, topicItemForms.state.expandedTopicId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'topic', 'item', 'available-members', projectId, topicItemForms.state.expandedTopicId, topicItemForms.memberState.managingMembersForItemId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'topics', projectId] })
      invalidateDetail()
      topicItemForms.memberState.setManageMembersError('')
    },
    onError: (err: any) => {
      topicItemForms.memberState.setManageMembersError(err?.response?.data?.message || err?.message || 'Error al asignar miembro')
    },
  })

  const unassignItemMemberMutation = useMutation({
    mutationFn: (payload: { topicId: string; itemId: string; assignmentId: string }) =>
      unassignMemberFromTopicItem(projectId, payload.topicId, payload.itemId, payload.assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'topic', 'items', projectId, topicItemForms.state.expandedTopicId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'topic', 'item', 'available-members', projectId, topicItemForms.state.expandedTopicId, topicItemForms.memberState.managingMembersForItemId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'topics', projectId] })
      invalidateDetail()
      topicItemForms.memberState.setManageMembersError('')
    },
    onError: (err: any) => {
      topicItemForms.memberState.setManageMembersError(err?.response?.data?.message || err?.message || 'Error al desasignar miembro')
    },
  })

  const openNewTopicItem = () => topicItemForms.openNewTopicItem()
  const openEditTopicItem = (item: ApiTopicItem) => topicItemForms.openEditTopicItem(item)
  const openManageMembersForItem = (item: ApiTopicItem) => topicItemForms.openManageMembersForItem(item)

  const loadFilesForItem = useCallback(async (topicId: string, itemId: string, force = false) => {
    const key = `${topicId}__${itemId}`
    if (!force && itemFilesCache.has(key)) return
    setItemFilesLoading((prev) => new Set(prev).add(itemId))
    setItemFilesError((prev) => {
      const next = new Map(prev)
      next.delete(itemId)
      return next
    })
    try {
      const list = await fetchTopicItemFiles(projectId, topicId, itemId)
      setItemFilesCache((prev) => {
        const next = new Map(prev)
        next.set(key, list ?? [])
        return next
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudieron cargar los documentos vinculados'
      setItemFilesError((prev) => {
        const next = new Map(prev)
        next.set(itemId, msg)
        return next
      })
      setItemFilesCache((prev) => {
        const next = new Map(prev)
        next.set(key, [])
        return next
      })
      console.warn('[ProjectDetailPage] loadFilesForItem failed:', topicId, itemId, e)
    } finally {
      setItemFilesLoading((prev) => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
  }, [projectId, itemFilesCache])

  const optimisticRemoveLinkedFile = useCallback((topicId: string, itemId: string, fileId: string) => {
    const key = `${topicId}__${itemId}`
    setItemFilesCache((prev) => {
      const snapshot = prev.get(key) ?? []
      const nextArr = snapshot.filter((f) => f.fileId !== fileId)
      const next = new Map(prev)
      next.set(key, nextArr)
      return next
    })
  }, [])

  const forceReloadLinkedFiles = useCallback((topicId: string, itemId: string) => {
    void loadFilesForItem(topicId, itemId, true)
  }, [loadFilesForItem])

  const onGotoLinkedFile = useCallback(async (fileId: string) => {
    const pools: Array<Iterable<ApiFile> | undefined | null> = [
      filesQuery.data?.items,
      meetingFilesQuery.data,
      masterFilesQuery.data?.items,
    ]
    let file: ApiFile | null = null
    const target = fileId.toLowerCase()
    const findIn = (pool: Iterable<ApiFile>): ApiFile | null => {
      for (const item of pool) {
        if (item.id.toLowerCase() === target) return item
      }
      return null
    }
    for (const pool of pools) {
      if (pool) {
        const found = findIn(pool)
        if (found) { file = found; break }
      }
    }
    if (!file) {
      try {
        const all = await fetchFiles({ projectId, folderId: 'all', page: 1, pageSize: 500 })
        for (const it of all.items) {
          if (it.id.toLowerCase() === target) { file = it; break }
        }
      } catch (_e) {
        // no se pudo, continuamos sin carpeta
      }
    }
    const fId = file?.folderId ?? null
    const chain: string[] = []
    if (fId) {
      const seen = new Set<string>()
      let cur: string | null = fId
      while (cur && !seen.has(cur)) {
        seen.add(cur)
        chain.push(cur)
        const node = flatFolderById.get(cur)
        if (!node || !node.parentId) break
        cur = node.parentId
      }
    } else {
      setPageToast({ kind: 'error', title: 'No se pudo ubicar el archivo', message: 'No se pudo ubicar la carpeta del archivo. Pruebe abriendo la pestaña Documentos primero y vuelva a intentar.' })
    }
    const ancestorSet = chain.length ? new Set(chain) : null
    setForceExpandFolderIds(ancestorSet)
    setSelectedFolderId(fId)
    setActiveTab('docs')
    setHighlightFileId(fileId)
    window.setTimeout(() => {
      setHighlightFileId((curr) => (curr === fileId ? null : curr))
    }, 4000)
  }, [filesQuery.data, meetingFilesQuery.data, masterFilesQuery.data, flatFolderById, projectId, fetchFiles, setPageToast])

  const linkTopicItemFileMutation = useMutation({
    mutationFn: (payload: { topicId: string; itemId: string; fileId: string }) =>
      linkFileToTopicItem(projectId, payload.topicId, payload.itemId, payload.fileId),
    onSuccess: () => {
      const topicId = topicItemForms.state.expandedTopicId
      const itemId = linkingTopicItemId
      if (topicId && itemId) {
        queryClient.invalidateQueries({
          queryKey: ['project', 'topic', 'item', 'files', projectId, topicId, itemId],
        })
        forceReloadLinkedFiles(topicId, itemId)
      }
      closeTopicItemFilePicker()
      setPageToast({ kind: 'success', title: 'Documento vinculado', message: 'El documento se vinculó al concepto.' })
    },
    onError: (err: any) => {
      setPageToast({
        kind: 'error',
        title: 'No se pudo vincular el documento',
        message: err?.response?.data?.message || err?.message || 'Error desconocido.',
      })
    },
  })

  const unlinkTopicItemFileMutation = useMutation({
    mutationFn: (payload: { topicId: string; itemId: string; fileId: string }) =>
      unlinkFileFromTopicItem(projectId, payload.topicId, payload.itemId, payload.fileId),
    onMutate: (vars) => {
      optimisticRemoveLinkedFile(vars.topicId, vars.itemId, vars.fileId)
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['project', 'topic', 'item', 'files', projectId, vars.topicId, vars.itemId],
      })
      setPageToast({ kind: 'success', title: 'Documento desvinculado', message: 'Se retiró la referencia del concepto.' })
    },
    onError: (err: any, vars) => {
      forceReloadLinkedFiles(vars.topicId, vars.itemId)
      setPageToast({
        kind: 'error',
        title: 'No se pudo desvincular',
        message: err?.response?.data?.message || err?.message || 'Error desconocido.',
      })
    },
  })

  const onPickTopicItemFile = (fileId: string) => {
    const topicId = topicItemForms.state.expandedTopicId
    const itemId = linkingTopicItemId
    if (!topicId || !itemId) return
    linkTopicItemFileMutation.mutate({ topicId, itemId, fileId })
  }

  const handleSubmitTopicItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (topicItemForms.state.editingTopicItem) {
      const payload = topicItemForms.buildUpdateTopicItemPayload()
      if (payload) updateTopicItemMutation.mutate(payload)
    } else {
      const payload = topicItemForms.buildCreateTopicItemPayload()
      if (payload) createTopicItemMutation.mutate(payload)
    }
  }

  const openNewTopic = () => topicForms.openNewTopic()
  const openEditTopic = (t: ApiTopic) => topicForms.openEditTopic(t)

  const handleSubmitTopic = (e: React.FormEvent) => {
    e.preventDefault()
    if (topicForms.state.editingTopic) {
      const payload = topicForms.buildUpdateTopicPayload()
      if (payload) updateTopicMutation.mutate(payload)
    } else {
      const payload = topicForms.buildCreateTopicPayload()
      if (payload) createTopicMutation.mutate(payload)
    }
  }

  const upsertMeetingParticipantMutation = useMutation({
    mutationFn: (payload: { meetingId: string; userId: string; roleName?: string | null; attended?: boolean }) =>
      upsertMeetingParticipant(projectId, payload.meetingId, {
      userId: payload.userId,
      roleName: payload.roleName,
      attended: payload.attended,
    }),
    onSuccess: () => {
      if (expandedMeetingId) {
        queryClient.invalidateQueries({ queryKey: ['project', 'meeting', 'participants', projectId, expandedMeetingId] })
      }
    },
    onError: (err: any) => {
      setPageToast({
        kind: 'error',
        title: 'No se pudo guardar el asistente',
        message:
          err?.response?.data?.message || err?.message || 'Error desconocido. Inténtalo de nuevo.',
      })
    },
  })

  const setMeetingAttendanceMutation = useMutation({
    mutationFn: (payload: { meetingId: string; userId: string; attended: boolean }) =>
      setMeetingAttendance(projectId, payload.meetingId, payload.userId, payload.attended),
    onSuccess: () => {
      if (expandedMeetingId) {
        queryClient.invalidateQueries({ queryKey: ['project', 'meeting', 'participants', projectId, expandedMeetingId] })
      }
    },
  })

  const removeMeetingParticipantMutation = useMutation({
    mutationFn: (payload: { meetingId: string; userId: string }) =>
      removeMeetingParticipant(projectId, payload.meetingId, payload.userId),
    onSuccess: () => {
      if (expandedMeetingId) {
        queryClient.invalidateQueries({ queryKey: ['project', 'meeting', 'participants', projectId, expandedMeetingId] })
      }
    },
    onError: (err: any) => {
      setPageToast({
        kind: 'error',
        title: 'No se pudo retirar el asistente',
        message:
          err?.response?.data?.message || err?.message || 'Error desconocido. Inténtalo de nuevo.',
      })
    },
  })

  const setMeetingMinutesFileMutation = useMutation({
    mutationFn: (payload: { meetingId: string; minutesFileId: string | null }) =>
      apiSetMeetingMinutesFile(projectId, payload.meetingId, payload.minutesFileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'meetings', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'files', projectId], exact: false })
      queryClient.invalidateQueries({ queryKey: ['project', 'meeting', 'file-picker', 'files', projectId], exact: false })
    },
    onError: (err: any) => {
      setPageToast({
        kind: 'error',
        title: 'No se pudo actualizar el archivo del acta',
        message:
          err?.response?.data?.message || err?.message || 'Error desconocido. Inténtalo de nuevo.',
      })
    },
  })

  // --- Temas vinculados a reunión ---
  const meetingLinkedTopicsQuery = useQuery({
    queryKey: ['project', 'meeting', 'linked-topics', projectId, linkingTopicsForMeetingId],
    queryFn: async () =>
      apiFetchMeetingLinkedTopics(projectId, linkingTopicsForMeetingId as string),
    enabled: Boolean(projectId) && Boolean(linkingTopicsForMeetingId),
  })

  const linkTopicToMeetingMutation = useMutation({
    mutationFn: (payload: { meetingId: string; topicId: string }) =>
      apiLinkTopicToMeeting(projectId, payload.meetingId, payload.topicId),
    onSuccess: (updatedMeeting) => {
      // Actualiza meetingsQuery con la reunión actualizada (incluye linkedTopicsIds nuevo)
      queryClient.setQueryData<PaginatedData<ApiMeeting> | undefined>(
        ['project', 'meetings', projectId],
        (old) => {
          if (!old) return old
          return {
            ...old,
            items: old.items.map((m) => (m.id === updatedMeeting.id ? { ...m, ...updatedMeeting } : m)),
          }
        }
      )
      queryClient.invalidateQueries({
        queryKey: ['project', 'meeting', 'linked-topics', projectId, updatedMeeting.id],
      })
      invalidateDetail()
    },
    onError: (err: any) => {
      setPageToast({
        kind: 'error',
        title: 'No se pudo vincular el tema',
        message:
          err?.response?.data?.message || err?.message || 'Error desconocido. Inténtalo de nuevo.',
      })
    },
  })

  const unlinkTopicFromMeetingMutation = useMutation({
    mutationFn: (payload: { meetingId: string; topicId: string }) =>
      apiUnlinkTopicFromMeeting(projectId, payload.meetingId, payload.topicId),
    onSuccess: (updatedMeeting) => {
      queryClient.setQueryData<PaginatedData<ApiMeeting> | undefined>(
        ['project', 'meetings', projectId],
        (old) => {
          if (!old) return old
          return {
            ...old,
            items: old.items.map((m) => (m.id === updatedMeeting.id ? { ...m, ...updatedMeeting } : m)),
          }
        }
      )
      queryClient.invalidateQueries({
        queryKey: ['project', 'meeting', 'linked-topics', projectId, updatedMeeting.id],
      })
      invalidateDetail()
    },
    onError: (err: any) => {
      setPageToast({
        kind: 'error',
        title: 'No se pudo desvincular el tema',
        message:
          err?.response?.data?.message || err?.message || 'Error desconocido. Inténtalo de nuevo.',
      })
    },
  })

  function handleAddMeetingParticipant(meetingId: string) {
    const uid = newParticipantUserId.trim()
    if (!uid) {
      setPageToast({ kind: 'error', title: 'Usuario requerido', message: 'Selecciona un usuario para agregar como asistente.' })
      return
    }
    upsertMeetingParticipantMutation.mutate({
      meetingId,
      userId: uid,
      roleName: newParticipantRole.trim() || null,
      attended: newParticipantAttended,
    }, {
      onSuccess: () => {
        setShowAddMeetingParticipant(null)
        setNewParticipantUserId('')
        setNewParticipantRole('')
        setNewParticipantAttended(false)
      },
    })
  }

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
      queryClient.invalidateQueries({ queryKey: ['project', 'files', projectId], exact: false })
      queryClient.invalidateQueries({ queryKey: ['project', 'detail', projectId] })
      setRenameFolder(null)
      setRenameFolderName('')
      setRenameFolderError('')
    },
    onError: (err: unknown) => {
      setRenameFolderError(err instanceof Error ? err.message : 'Error desconocido')
    },
  })

  const [renameFile, setRenameFile] = useState<ApiFile | null>(null)
  const [renameFileName, setRenameFileName] = useState('')
  const [renameFileError, setRenameFileError] = useState('')
  const renameFileMutation = useMutation({
    mutationFn: (payload: { id: string; name: string }) =>
      updateFile(payload.id, { name: payload.name.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', 'folders', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'files', projectId], exact: false })
      queryClient.invalidateQueries({ queryKey: ['project', 'detail', projectId] })
      setRenameFile(null)
      setRenameFileName('')
      setRenameFileError('')
    },
    onError: (err: unknown) => {
      setRenameFileError(err instanceof Error ? err.message : 'Error desconocido')
    },
  })

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
      queryClient.invalidateQueries({ queryKey: ['project', 'files', projectId], exact: false })
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
      queryClient.invalidateQueries({ queryKey: ['project', 'files', projectId], exact: false })
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
      queryClient.invalidateQueries({ queryKey: ['project', 'files', projectId], exact: false })
      queryClient.invalidateQueries({ queryKey: ['project', 'folders', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'detail', projectId] })
      if (selectedResource?.type === 'file' && selectedResource.id === deletedFileId) {
        setSelectedResource(null)
      }
    },
    onError: (err: any) => {
      if (err?.response?.status === 403) {
        const details = err?.response?.data?.details
        const fallbackFile = confirmDeleteFile
        const fileName = (details?.fileName as string | undefined)
          ?? (fallbackFile ? `${fallbackFile.name}${fallbackFile.extension ? `.${fallbackFile.extension}` : ''}` : null)
        const ownerFullName = (details?.ownerFullName as string | null | undefined) ?? fallbackFile?.ownerName ?? null
        const ownerEmail = (details?.ownerEmail as string | null | undefined) ?? fallbackFile?.ownerEmail ?? null
        setShowForbiddenDelete({
          open: true,
          scope: 'file',
          fileName,
          ownerFullName,
          ownerEmail,
          requesterFullName: authUser?.fullName ?? null,
        })
      } else {
        alert(err?.response?.data?.message || err?.message || 'No se pudo eliminar el archivo')
      }
    },
  })

  const deleteFolderMutation = useMutation({
    mutationFn: (folderId: string) => deleteFolder(folderId),
    onSuccess: (_data, deletedFolderId) => {
      queryClient.invalidateQueries({ queryKey: ['project', 'folders', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', 'files', projectId], exact: false })
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
      queryClient.invalidateQueries({ queryKey: ['project', 'files', projectId], exact: false })
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

  if (redirectNoProject || redirectNotFound) {
    return <Navigate to="/projects" replace />
  }

  return (
    <div className="flex flex-col h-full">
      <ProjectHeader
        detailIsLoading={detailIsLoading}
        project={project}
        projectGradientClass={projectGradientClass}
        headerBadge={headerBadge}
        ownerNameText={ownerNameText}
        stats={stats}
        formatRelativeTime={formatRelativeTime}
        isLocalFavorite={isLocalFavorite}
        handleToggleFavorite={handleToggleFavorite}
        canManageMembers={canManageMembers}
        setShowInviteMember={setShowInviteMember}
        setInviteSelectedUserId={setInviteSelectedUserId}
        setInviteSearch={setInviteSearch}
        setInviteError={setInviteError}
        isUploading={isUploading}
        uploadPercent={uploadPercent}
        fileInputRef={fileInputRef}
        onFilePicked={onFilePicked}
        headerMenuOpen={headerMenuOpen}
        setHeaderMenuOpen={setHeaderMenuOpen}
        openEditProject={openEditProject}
        setShowDeleteProject={setShowDeleteProject}
        tabs={tabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {activeTab === 'docs' && (
        <ProjectDocsTab
          isResizing={isResizing}
          treeWidth={treeWidth}
          TREE_MIN_W={TREE_MIN_W}
          TREE_MAX_W={TREE_MAX_W}
          startResize={startResize}
          resizerOnKey={resizerOnKey}
          folderTree={folderTree}
          foldersAreLoading={foldersAreLoading}
          selectedFolderId={selectedFolderId}
          setSelectedFolderId={setSelectedFolderId}
          docMaestroCarpetaId={project?.docMaestroCarpetaId}
          setFolderContextMenu={setFolderContextMenu}
          setFileContextMenu={setFileContextMenu}
          setDocsAreaContextMenu={setDocsAreaContextMenu}
          setSelectedResource={handleSelectResourceOrTogglePanel}
          breadcrumbChain={breadcrumbChain}
          visibleFoldersCurrentLevel={visibleFoldersCurrentLevel}
          docsSearchInput={docsSearchInput}
          setDocsSearchInput={setDocsSearchInput}
          project={project}
          createFolderMutationPending={createFolderMutation.isPending}
          setShowNewFolder={setShowNewFolder}
          setNewFolderName={setNewFolderName}
          setNewFolderError={setNewFolderError}
          filesIsLoading={filesIsLoading}
          filesItems={filesQuery.data?.items}
          handleToggleFavorite={handleToggleFavorite}
          isLocalFavorite={isLocalFavorite}
          selectedId={selectedId}
          selectedType={selectedType as 'file' | 'folder' | undefined}
          projectId={projectId}
          highlightFileId={highlightFileId}
          forceExpandFolderIds={forceExpandFolderIds}
        />
      )}

      {activeTab === 'team' && (
        <ProjectTeamTab
          project={project ?? null}
          members={membersQuery.data?.items}
          membersLoading={membersQuery.isLoading}
          membersFetchStatus={membersQuery.fetchStatus}
          canManageMembers={canManageMembers}
          confirmRemoveMemberId={confirmRemoveMember?.id ?? null}
          removeMemberMutationPending={removeMemberMutation.isPending}
          onAddMemberClick={() => {
            setShowInviteMember(true)
            setInviteSelectedUserId(null)
            setInviteSearch('')
            setInviteError('')
          }}
          onRemoveMemberClick={(m) => setConfirmRemoveMember(m)}
        />
      )}

      {activeTab === 'master' && project && (
        <ProjectMasterTab
          documentoMaestro={detail?.documentoMaestro ?? null}
          canAdminMaster={canAdminMaster}
          clearMasterMutationPending={clearMasterMutation.isPending}
          onOpenMasterResource={(documentoMaestro) => {
            if (documentoMaestro.resourceType === 'FOLDER') {
              setSelectedFolderId(documentoMaestro.resourceId)
              setActiveTab('docs')
            } else {
              handleSelectResourceOrTogglePanel({ type: 'file', id: documentoMaestro.resourceId })
              setActiveTab('docs')
            }
          }}
          onOpenDesignateMasterModal={() => {
            setMasterSelectorTab(selectedFolderId ? 'folders' : 'files')
            setMasterSelectedFolderId(selectedFolderId)
            setMasterSelectedFileId(null)
            setShowMasterSelector(true)
          }}
          onClearMaster={() => setShowConfirmClearMaster(true)}
        />
      )}

      {activeTab === 'meetings' && (
        <ProjectMeetingsTab
          meetingsSearch={meetingsSearch}
          setMeetingsSearch={setMeetingsSearch}
          meetingsStatusFilter={meetingsStatusFilter}
          setMeetingsStatusFilter={setMeetingsStatusFilter}
          meetingsPage={meetingsPage}
          setMeetingsPage={setMeetingsPage}
          canEditMeetings={canEditMeetings}
          canDeleteMeetings={canDeleteMeetings}
          meetingsLoading={meetingsQuery.isLoading}
          meetingsFetchStatus={meetingsQuery.fetchStatus}
          meetingsError={meetingsQuery.isError}
          meetingsItems={meetingsQuery.data?.items}
          meetingsTotal={meetingsQuery.data?.total}
          meetingsTotalPages={meetingsQuery.data?.totalPages}
          meetingsCurrentPage={meetingsQuery.data?.page}
          participantsLoading={meetingParticipantsQuery.isLoading}
          participantsError={meetingParticipantsQuery.isError}
          participantsItems={meetingParticipantsQuery.data?.items}
          meetingFiles={meetingFilesQuery.data}
          expandedMeetingId={expandedMeetingId}
          setExpandedMeetingId={setExpandedMeetingId}
          meetingPanelTab={meetingPanelTab}
          setMeetingPanelTab={setMeetingPanelTab}
          showAddMeetingParticipant={showAddMeetingParticipant}
          setShowAddMeetingParticipant={setShowAddMeetingParticipant}
          newParticipantUserId={newParticipantUserId}
          setNewParticipantUserId={setNewParticipantUserId}
          newParticipantRole={newParticipantRole}
          setNewParticipantRole={setNewParticipantRole}
          newParticipantAttended={newParticipantAttended}
          setNewParticipantAttended={setNewParticipantAttended}
          members={membersQuery.data?.items}
          setRemoveMeetingFileId={setRemoveMeetingFileId}
          removeMeetingFileId={removeMeetingFileId}
          onOpenFilePicker={openMeetingFilePicker}
          confirmDeleteMeeting={confirmDeleteMeeting}
          setConfirmDeleteMeeting={setConfirmDeleteMeeting}
          upsertParticipantPending={upsertMeetingParticipantMutation.isPending}
          setAttendancePending={setMeetingAttendanceMutation.isPending}
          removeParticipantPending={removeMeetingParticipantMutation.isPending}
          setMinutesFilePending={setMeetingMinutesFileMutation.isPending}
          deleteMeetingPending={deleteMeetingMutation.isPending}
          projectTopicsItems={topicsQuery.data?.items}
          linkingTopicsForMeetingId={linkingTopicsForMeetingId}
          setLinkingTopicsForMeetingId={setLinkingTopicsForMeetingId}
          meetingLinkedTopicsLoading={meetingLinkedTopicsQuery.isLoading}
          meetingLinkedTopicsItems={meetingLinkedTopicsQuery.data ?? []}
          linkTopicPending={linkTopicToMeetingMutation.isPending}
          unlinkTopicPending={unlinkTopicFromMeetingMutation.isPending}
          onLinkTopic={(meetingId, topicId) => linkTopicToMeetingMutation.mutate({ meetingId, topicId })}
          onUnlinkTopic={(meetingId, topicId) => unlinkTopicFromMeetingMutation.mutate({ meetingId, topicId })}
          onNewMeeting={openNewMeeting}
          onEditMeeting={openEditMeeting}
          onSubmitAddParticipant={handleAddMeetingParticipant}
          onToggleAttendance={(meetingId, userId, attended) =>
            setMeetingAttendanceMutation.mutate({ meetingId, userId, attended })
          }
          onRemoveParticipant={(meetingId, userId) =>
            removeMeetingParticipantMutation.mutate({ meetingId, userId })
          }
          onConfirmUnlinkActa={(meetingId) => {
            setMeetingMinutesFileMutation.mutate(
              { meetingId, minutesFileId: null },
              { onSettled: () => setRemoveMeetingFileId(null) },
            )
          }}
        />
      )}

      {activeTab === 'topics' && (
        <ProjectTopicsTab
          topicFilters={{
            topicsSearch,
            setTopicsSearch,
            topicsStatusFilter,
            setTopicsStatusFilter,
            topicsPage,
            setTopicsPage,
            topicsPageSize,
          }}
          topicUiState={{
            topicsLoading: topicsQuery.isLoading,
            topicsFetchStatus: topicsQuery.fetchStatus,
            topicsIsError: topicsQuery.isError,
          }}
          topicPaginationData={{
            topicsItems: topicsQuery.data?.items,
            topicsTotal: topicsQuery.data?.total,
            topicsTotalPages: topicsQuery.data?.totalPages,
            topicsCurrentPage: topicsQuery.data?.page,
          }}
          topicFormsState={topicForms.state}
          topicItemFilters={{
            topicItemsSearch,
            setTopicItemsSearch,
            topicItemsStatusFilter,
            setTopicItemsStatusFilter,
            topicItemsPage,
            topicItemsPageSize,
          }}
          topicItemUiState={{
            topicItemsLoading: topicItemsQuery.isLoading,
            topicItemsIsError: topicItemsQuery.isError,
          }}
          topicItemPaginationData={{
            topicItemsItems: topicItemsQuery.data?.items,
            topicItemsTotal: topicItemsQuery.data?.total,
          }}
          topicItemFormsState={topicItemForms.state}
          topicMemberMgmtState={topicItemForms.memberState}
          topicAvailableMembersUi={{
            topicItemAvailableMembersLoading: topicItemAvailableMembersQuery.isLoading,
            topicItemAvailableMembersIsError: topicItemAvailableMembersQuery.isError,
            topicItemAvailableMembersItems: topicItemAvailableMembersQuery.data,
          }}
          pending={{
            createTopicPending: createTopicMutation.isPending,
            updateTopicPending: updateTopicMutation.isPending,
            deleteTopicPending: deleteTopicMutation.isPending,
            createTopicItemPending: createTopicItemMutation.isPending,
            updateTopicItemPending: updateTopicItemMutation.isPending,
            deleteTopicItemPending: deleteTopicItemMutation.isPending,
            assignItemMemberPending: assignItemMemberMutation.isPending,
            unassignItemMemberPending: unassignItemMemberMutation.isPending,
            linkTopicItemFilePending: linkTopicItemFileMutation.isPending,
            unlinkTopicItemFilePending: unlinkTopicItemFileMutation.isPending,
          }}
          callbacks={{
            onNewTopic: openNewTopic,
            onEditTopic: openEditTopic,
            onSubmitTopic: handleSubmitTopic,
            onConfirmDeleteTopic: () => { if (topicForms.state.confirmDeleteTopic) deleteTopicMutation.mutate(topicForms.state.confirmDeleteTopic.id) },
            onNewTopicItem: openNewTopicItem,
            onEditTopicItem: openEditTopicItem,
            onSubmitTopicItem: handleSubmitTopicItem,
            onConfirmDeleteTopicItem: () => { if (topicItemForms.state.confirmDeleteTopicItem && topicItemForms.state.expandedTopicId) deleteTopicItemMutation.mutate({ topicId: topicItemForms.state.expandedTopicId, itemId: topicItemForms.state.confirmDeleteTopicItem.id }) },
            onOpenManageMembersForItem: openManageMembersForItem,
            onAssignItemMember: (pmId) => { if (topicItemForms.state.expandedTopicId && topicItemForms.memberState.managingMembersForItemId) assignItemMemberMutation.mutate({ topicId: topicItemForms.state.expandedTopicId, itemId: topicItemForms.memberState.managingMembersForItemId, projectMemberId: pmId }) },
            onUnassignItemMember: (assignmentId) => { if (topicItemForms.state.expandedTopicId && topicItemForms.memberState.managingMembersForItemId) unassignItemMemberMutation.mutate({ topicId: topicItemForms.state.expandedTopicId, itemId: topicItemForms.memberState.managingMembersForItemId, assignmentId }) },
            onOpenFilePickerForItem: (item) => openTopicItemFilePicker(item.id),
            onUnlinkItemFile: (item, f) => { if (topicItemForms.state.expandedTopicId) unlinkTopicItemFileMutation.mutate({ topicId: topicItemForms.state.expandedTopicId, itemId: item.id, fileId: f.fileId }) },
            onGotoLinkedFile,
            fetchLinkedFilesForItem: (topicId, itemId) => fetchTopicItemFiles(projectId, topicId, itemId),
            forceReloadLinkedFiles,
            optimisticRemoveLinkedFile,
            filePickerFiles: meetingFilesQuery.data,
            filePickerLoading: meetingFilesQuery.isLoading && meetingFilesQuery.fetchStatus !== 'idle',
          }}
          itemFilesCache={itemFilesCache}
          itemFilesLoading={itemFilesLoading}
          itemFilesError={itemFilesError}
          canEditTopics={canEditTopics}
          canDeleteTopics={canDeleteTopics}
          canAddTopicItems={canEditTopics}
          canEditTopicItems={canEditTopics}
          canDeleteTopicItems={canDeleteTopics}
          canAssignItemMembers={canEditTopics}
          canLinkItemFiles={canEditTopics}
          formatRelativeTime={formatRelativeTime}
        />
      )}

      {activeTab === 'contributions' && (
        <ProjectAportesTab
          filters={{
            search: aporteSearch,
            setSearch: setAporteSearch,
            tipoFilter: aporteTipoFilter,
            setTipoFilter: setAporteTipoFilter,
            estadoFilter: aporteEstadoFilter,
            setEstadoFilter: setAporteEstadoFilter,
            importanciaFilter: aporteImportanciaFilter,
            setImportanciaFilter: setAporteImportanciaFilter,
            offset: aporteOffset,
            setOffset: setAporteOffset,
            limit: aporteLimit,
          }}
          listUi={{
            items: aportesQuery.data?.items,
            total: aportesQuery.data?.meta.total,
            limit: aporteLimit,
            offset: aporteOffset,
            loading: aportesQuery.isLoading,
            isError: aportesQuery.isError,
          }}
          forms={aporteForms.state}
          pending={{
            createPending: createContributionMutation.isPending,
            updatePending: updateContributionMutation.isPending,
            deletePending: deleteContributionMutation.isPending,
            linkTopicPending: linkAporteTopicMutation.isPending,
            unlinkTopicPending: unlinkAporteTopicMutation.isPending,
          }}
          callbacks={{
            onNewAporte: openNewAporte,
            onEditAporte: openEditAporte,
            onSubmitAporte: handleSubmitAporte,
            onConfirmDeleteAporte,
            onOpenLinkTopic: (a) => aporteForms.openLinkTopic(a),
            onSubmitLinkTopic,
            onUnlinkTopic,
            onSelectAttachedFile,
            onClearAttachedFile,
            onOpenAttachFilePicker: openAporteFilePicker,
            onPickExistingAttachedFile,
          }}
          linkTopicUi={{
            availableTopicsLoading: topicsQuery.isLoading,
            availableTopicsIsError: topicsQuery.isError,
            availableTopics: (topicsQuery.data?.items ?? []).map((t) => ({
              ...t,
              alreadyLinked: (aporteLinkedTopicsQuery.data ?? []).some((l) => l.topicId === t.id),
            })),
            linkedTopics: aporteLinkedTopicsQuery.data,
            linkedTopicsLoading: aporteLinkedTopicsQuery.isLoading,
          }}
          canCreateAportes={canCreateAportes}
          canEditAportes={canEditAportes}
          canDeleteAportes={canDeleteAportes}
          formatRelativeTime={formatRelativeTime}
        />
      )}

      {activeTab === 'activity' && project && (
        <ProjectActivityTab projectId={projectId} />
      )}

      {activeTab !== 'docs' && activeTab !== 'team' && activeTab !== 'master' && activeTab !== 'meetings' && activeTab !== 'topics' && activeTab !== 'contributions' && activeTab !== 'activity' && (
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

      <ProjectNewFolderModal
        open={showNewFolder && !!project}
        project={project}
        selectedFolderId={selectedFolderId}
        flatFolderById={flatFolderById}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        newFolderError={newFolderError}
        createPending={createFolderMutation.isPending}
        createError={createFolderMutation.error}
        onClose={() => {
          setShowNewFolder(false)
          setNewFolderName('')
          setNewFolderError('')
        }}
        onSubmit={handleCreateFolder}
      />

      <RenameFolderModal
        folder={renameFolder}
        nameValue={renameFolderName}
        setNameValue={setRenameFolderName}
        errorMsg={renameFolderError}
        setErrorMsg={setRenameFolderError}
        mutationPending={renameFolderMutation.isPending}
        mutationError={renameFolderMutation.error ?? null}
        onClose={() => {
          setRenameFolder(null)
          setRenameFolderName('')
          setRenameFolderError('')
        }}
        onSubmitRename={(n) => {
          if (renameFolder) renameFolderMutation.mutate({ id: renameFolder.id, name: n })
        }}
      />

      <RenameFileModal
        file={renameFile}
        nameValue={renameFileName}
        setNameValue={setRenameFileName}
        errorMsg={renameFileError}
        setErrorMsg={setRenameFileError}
        mutationPending={renameFileMutation.isPending}
        mutationError={renameFileMutation.error}
        inputRef={renameFileInputRef}
        onClose={() => {
          setRenameFile(null)
          setRenameFileName('')
          setRenameFileError('')
        }}
        onSubmitClick={(e, fallbackName) => {
          e.preventDefault()
          if (renameFileMutation.isPending) return
          const form = e.currentTarget.closest('form')
          const input = form?.querySelector<HTMLInputElement>('input[type="text"], input:not([type])')
          const raw = input?.value ?? fallbackName
          const n = raw.trim()
          if (!renameFile || n.length === 0 || n.length > 255) {
            setRenameFileError('Nombre de archivo inválido (1..255 caracteres)')
            return
          }
          setRenameFileName(n)
          setRenameFileError('')
          renameFileMutation.mutate({ id: renameFile.id, name: n })
        }}
      />
      <CommentFileDialog
        file={commentFile}
        content={commentContent}
        setContent={setCommentContent}
        errorMsg={commentError}
        setErrorMsg={setCommentError}
        mutationPending={commentFileMutation.isPending}
        mutationError={commentFileMutation.error}
        inputRef={commentFileInputRef}
        onClose={() => {
          setCommentFile(null)
          setCommentContent('')
          setCommentError('')
        }}
        onSubmitClick={(e, trimmed) => {
          e.preventDefault()
          if (!commentFile || commentFileMutation.isPending) return
          if (trimmed.length === 0 || trimmed.length > 2000) {
            setCommentError('El comentario debe tener entre 1 y 2000 caracteres')
            return
          }
          setCommentError('')
          commentFileMutation.mutate({ id: commentFile.id, content: trimmed })
        }}
      />
      <TransferDialog
        dialog={transferDialog}
        folderTree={folderTree}
        disabledFolderIds={disabledFolderIdsForTransfer}
        transferIsPending={transferIsPending}
        transferFileMoveError={transferFileMoveMutation.error}
        transferFileCopyError={transferFileCopyMutation.error}
        transferFolderMoveError={transferFolderMoveMutation.error}
        transferFolderCopyError={transferFolderCopyMutation.error}
        onChange={(next) => setTransferDialog((prev) => (prev ? { ...prev, ...next } : prev))}
        onClose={() => setTransferDialog(null)}
        onSubmit={() => handleTransferSubmit(() => setTransferDialog(null))}
      />

      <EditProjectModal
        open={showEditProject && !!project}
        project={project}
        mutationPending={updateMutation.isPending}
        form={editForm}
        setForm={setEditForm}
        onClose={() => setShowEditProject(false)}
        onSubmit={handleSubmitEdit}
      />

      <MasterSelectorModal
        open={showMasterSelector && !!project}
        project={project}
        masterSelectorTab={masterSelectorTab}
        setMasterSelectorTab={setMasterSelectorTab}
        masterSelectedFolderId={masterSelectedFolderId}
        setMasterSelectedFolderId={setMasterSelectedFolderId}
        masterSelectedFileId={masterSelectedFileId}
        setMasterSelectedFileId={setMasterSelectedFileId}
        folderTree={folderTree}
        filesIsLoading={masterFilesQuery.isLoading && masterFilesQuery.fetchStatus !== 'idle'}
        filesItems={masterFilesQuery.data?.items}
        designatePending={designateMasterMutation.isPending}
        onClose={() => setShowMasterSelector(false)}
        onSubmit={handleMasterDesignateSubmit}
      />

      <ConfirmClearMasterDialog
        open={showConfirmClearMaster}
        mutationPending={clearMasterMutation.isPending}
        onClose={() => setShowConfirmClearMaster(false)}
        onConfirm={() => clearMasterMutation.mutate()}
      />

      <FolderContextMenu
        menu={folderContextMenu}
        folderCtxRef={folderCtxRef}
        clamp={ctxClamp}
        canAdminMaster={canAdminMaster}
        project={project}
        isMasterFolder={
          !!folderContextMenu &&
          project?.docMaestroCarpetaId !== null &&
          project?.docMaestroCarpetaId !== undefined &&
          String(project.docMaestroCarpetaId).toLowerCase() === String(folderContextMenu.folder.id).toLowerCase()
        }
        onClose={() => setFolderContextMenu(null)}
        onOpen={(folderId) => {
          if (!folderContextMenu) return
          setSelectedFolderId(folderId)
          handleSelectResourceOrTogglePanel({ type: 'folder', id: folderId })
        }}
        onRename={(folder) => {
          setRenameFolder(folder)
          setRenameFolderName(folder.name)
          setRenameFolderError('')
        }}
        onMoveCopy={(folder) => {
          setTransferDialog({
            resource: { type: 'folder', folder },
            mode: 'move',
            targetFolderId: folder.parentId ?? null,
            error: '',
          })
        }}
        onToggleFavorite={(folderId) => handleToggleFavorite('FOLDER', folderId)}
        isLocalFavorite={isLocalFavorite}
        onClearMaster={() => setShowConfirmClearMaster(true)}
        onDesignateMasterFolder={(folderId) =>
          designateMasterMutation.mutate({ resourceType: 'FOLDER', resourceId: folderId })
        }
        onDelete={(folder) => setConfirmDeleteFolder(folder)}
        designatePending={designateMasterMutation.isPending}
        clearPending={clearMasterMutation.isPending}
        deletePending={deleteFolderMutation.isPending}
        deletingId={deleteFolderMutation.variables}
      />

      <FileContextMenu
        menu={fileContextMenu}
        fileCtxRef={fileCtxRef}
        clamp={ctxClamp}
        canAdminMaster={canAdminMaster}
        project={project}
        isMasterFile={
          !!fileContextMenu &&
          project?.docMaestroArchivoId !== null &&
          project?.docMaestroArchivoId !== undefined &&
          String(project.docMaestroArchivoId).toLowerCase() === String(fileContextMenu.file.id).toLowerCase()
        }
        onClose={() => setFileContextMenu(null)}
        onOpenDownload={(file) => {
          if (file.downloadUrl) window.open(file.downloadUrl, '_blank', 'noopener,noreferrer')
        }}
        onRename={(file) => {
          setRenameFile(file)
          const extIdx = file.name.lastIndexOf('.')
          const base = extIdx > 0 ? file.name.slice(0, extIdx) : file.name
          setRenameFileName(base)
          setRenameFileError('')
        }}
        onMoveCopy={(file) => {
          setTransferDialog({
            resource: { type: 'file', file },
            mode: 'move',
            targetFolderId: file.folderId ?? null,
            error: '',
          })
        }}
        onComment={(file) => {
          setCommentFile(file)
          setCommentContent('')
          setCommentError('')
        }}
        onToggleFavorite={(fileId) => handleToggleFavorite('FILE', fileId)}
        isLocalFavorite={isLocalFavorite}
        onClearMaster={() => setShowConfirmClearMaster(true)}
        onDesignateMasterFile={(fileId) =>
          designateMasterMutation.mutate({ resourceType: 'FILE', resourceId: fileId })
        }
        onDelete={(file) => setConfirmDeleteFile(file)}
        designatePending={designateMasterMutation.isPending}
        clearPending={clearMasterMutation.isPending}
        deletePending={deleteFileMutation.isPending}
        deletingId={deleteFileMutation.variables}
        authUserId={authUser?.id ?? null}
        projectOwnerId={project?.ownerId ?? null}
      />

      <DocsAreaContextMenu
        menu={docsAreaContextMenu}
        project={project}
        createPending={createFolderMutation.isPending}
        isUploading={isUploading}
        uploadPending={uploadMutation.isPending}
        onClose={() => setDocsAreaContextMenu(null)}
        onCreateFolder={() => {
          setNewFolderName('')
          setNewFolderError('')
          setShowNewFolder(true)
        }}
        onUploadFile={() => fileInputRef.current?.click()}
      />

      <DeleteProjectDialog
        open={showDeleteProject && !!project}
        project={project}
        mutationPending={deleteMutation.isPending}
        onClose={() => setShowDeleteProject(false)}
        onConfirm={() => deleteMutation.mutate()}
      />

      <ForbiddenDeleteDialog
        open={showForbiddenDelete.open}
        onClose={() => setShowForbiddenDelete({ open: false })}
        scope={showForbiddenDelete.scope}
        fileName={showForbiddenDelete.fileName}
        ownerFullName={showForbiddenDelete.ownerFullName}
        ownerEmail={showForbiddenDelete.ownerEmail}
        requesterFullName={showForbiddenDelete.requesterFullName}
      />

      <ProjectConfirmDeleteFileDialog
        file={confirmDeleteFile}
        mutationPending={deleteFileMutation.isPending}
        onClose={() => setConfirmDeleteFile(null)}
        onConfirm={() => {
          if (confirmDeleteFile) deleteFileMutation.mutate(confirmDeleteFile.id)
          setConfirmDeleteFile(null)
        }}
      />

      <ConfirmDeleteFolderDialog
        folder={confirmDeleteFolder}
        mutationPending={deleteFolderMutation.isPending}
        onClose={() => setConfirmDeleteFolder(null)}
        onConfirm={() => {
          if (confirmDeleteFolder) deleteFolderMutation.mutate(confirmDeleteFolder.id)
          setConfirmDeleteFolder(null)
        }}
      />

      <ConfirmRemoveMemberDialog
        member={confirmRemoveMember}
        mutationPending={removeMemberMutation.isPending}
        onClose={() => setConfirmRemoveMember(null)}
        onConfirm={(memberId) =>
          removeMemberMutation.mutate(memberId, {
            onSettled: () => setConfirmRemoveMember(null),
          })
        }
      />

      <InviteMemberModal
        open={showInviteMember}
        canManageMembers={canManageMembers}
        inviteError={inviteError}
        inviteSearch={inviteSearch}
        setInviteSearch={setInviteSearch}
        inviteSelectedUserId={inviteSelectedUserId}
        setInviteSelectedUserId={setInviteSelectedUserId}
        inviteRole={inviteRole}
        setInviteRole={setInviteRole}
        orgMembersLoading={orgMembersQuery.isLoading}
        orgMembersFetching={orgMembersQuery.fetchStatus !== 'idle'}
        candidates={candidateOrgMembers}
        addPending={addMemberMutation.isPending}
        addError={addMemberMutation.error}
        onSubmit={handleAddMemberSubmit}
        onClose={() => {
          setShowInviteMember(false)
          setInviteSelectedUserId(null)
          setInviteSearch('')
          setInviteError('')
        }}
      />

      <ProjectPageToast
        pageToast={pageToast}
        onDismiss={() => setPageToast(null)}
      />

      <NewMeetingModal
        open={!!(showNewMeeting || editingMeeting)}
        editingMeeting={editingMeeting}
        form={newMeetingForm}
        setForm={setNewMeetingForm}
        createPending={createMeetingMutation.isPending}
        updatePending={updateMeetingMutation.isPending}
        onSubmit={handleSubmitMeeting}
        onClose={() => {
          setShowNewMeeting(false)
          setEditingMeeting(null)
        }}
      />

      <ConfirmDeleteMeetingDialog
        meeting={confirmDeleteMeeting}
        mutationPending={deleteMeetingMutation.isPending}
        onClose={() => setConfirmDeleteMeeting(null)}
        onConfirm={(meetingId) =>
          deleteMeetingMutation.mutate(meetingId, {
            onSettled: () => setConfirmDeleteMeeting(null),
          })
        }
      />

      <ProjectFilePickerModal
        open={showFilePicker}
        pickerMode={filePickerMode}
        filePickerSearch={filePickerSearch}
        setFilePickerSearch={setFilePickerSearch}
        filesLoading={meetingFilesQuery.isLoading}
        filesError={meetingFilesQuery.isError}
        files={meetingFilesQuery.data}
        linkPending={setMeetingMinutesFileMutation.isPending}
        expandedMeetingId={expandedMeetingId}
        onClose={() => {
          setShowFilePicker(false)
          setFilePickerSearch('')
        }}
        onSelect={(fileId, file) => {
          if (filePickerMode === 'meeting') {
            if (!expandedMeetingId || setMeetingMinutesFileMutation.isPending) return
            setMeetingMinutesFileMutation.mutate(
              { meetingId: expandedMeetingId, minutesFileId: fileId },
              {
                onSettled: () => {
                  setShowFilePicker(false)
                  setFilePickerSearch('')
                },
              }
            )
          } else if (filePickerMode === 'topic-item') {
            onPickTopicItemFile(fileId)
          } else {
            onPickExistingAttachedFile(fileId, file)
            setShowFilePicker(false)
            setFilePickerSearch('')
          }
        }}
      />
    </div>
  )
}

export default ProjectDetailPage
