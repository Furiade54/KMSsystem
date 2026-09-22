import type {
  ApiContributionPriority,
  ApiContributionStatus,
  ApiContributionType,
  ApiContributionTopicLink,
  ApiProjectContribution,
} from '@/services/aportes.service'
import type { ApiTopic } from '@/services/project-topics.service'

export type AporteFiltersState = {
  search: string
  setSearch: (v: string) => void
  tipoFilter: ApiContributionType | ''
  setTipoFilter: (v: ApiContributionType | '') => void
  estadoFilter: ApiContributionStatus | ''
  setEstadoFilter: (v: ApiContributionStatus | '') => void
  importanciaFilter: ApiContributionPriority | ''
  setImportanciaFilter: (v: ApiContributionPriority | '') => void
  offset: number
  setOffset: (v: number | ((p: number) => number)) => void
  limit: number
}

export type AporteAttachedFileMeta = {
  id: string
  name: string
  sizeBytes: number
  mimeType: string | null
}

export type AporteFormFields = {
  title: string
  setTitle: (v: string) => void
  content: string
  setContent: (v: string) => void
  type: ApiContributionType
  setType: (v: ApiContributionType) => void
  externalUrl: string
  setExternalUrl: (v: string) => void
  folderId: string | null
  setFolderId: (v: string | null) => void
  attachedFileId: string | null
  setAttachedFileId: (v: string | null) => void
  attachedFileMeta: AporteAttachedFileMeta | null
  setAttachedFileMeta: (v: AporteAttachedFileMeta | null) => void
  uploadPercent: number
  setUploadPercent: (v: number) => void
  uploading: boolean
  setUploading: (v: boolean) => void
  status: ApiContributionStatus
  setStatus: (v: ApiContributionStatus) => void
  priority: ApiContributionPriority
  setPriority: (v: ApiContributionPriority) => void
  order: number
  setOrder: (v: number) => void
  publishNow: boolean
  setPublishNow: (v: boolean) => void
  topicIds: string[]
  setTopicIds: (v: string[]) => void
  error: string
  setError: (v: string) => void
}

export type AporteFormsState = {
  showNewAporte: boolean
  setShowNewAporte: (v: boolean) => void
  editingAporte: ApiProjectContribution | null
  setEditingAporte: (v: ApiProjectContribution | null) => void
  formNew: AporteFormFields
  formEdit: AporteFormFields
  confirmDeleteAporte: ApiProjectContribution | null
  setConfirmDeleteAporte: (m: ApiProjectContribution | null) => void
  showLinkTopicModal: { aporteId: string; aporteTitle: string | null } | null
  setShowLinkTopicModal: (v: { aporteId: string; aporteTitle: string | null } | null) => void
}

export type AporteMutationsPending = {
  createPending: boolean
  updatePending: boolean
  deletePending: boolean
  linkTopicPending: boolean
  unlinkTopicPending: boolean
}

export type AporteCallbacks = {
  onNewAporte: () => void
  onEditAporte: (aporte: ApiProjectContribution) => void
  onSubmitAporte: (e: React.FormEvent) => void
  onConfirmDeleteAporte: () => void
  onToggleLike?: (aporte: ApiProjectContribution) => void
  onOpenLinkTopic: (aporte: ApiProjectContribution) => void
  onSubmitLinkTopic: (topicId: string) => void
  onUnlinkTopic: (aporteId: string, topicId: string) => void
  onSelectAttachedFile: (file: File) => void
  onClearAttachedFile: () => void
  onOpenAttachFilePicker: () => void
  onPickExistingAttachedFile: (fileId: string, file: { name: string; sizeBytes?: number | null; mimeType?: string | null }) => void
  onGotoAttachedFile: (fileId: string) => void
  onGotoLinkedTopic: (topicId: string) => void
}

export type AporteLinkTopicUiState = {
  availableTopicsLoading: boolean
  availableTopicsIsError: boolean
  availableTopics: Array<ApiTopic & { alreadyLinked: boolean }> | undefined
  linkedTopics: ApiContributionTopicLink[] | undefined
  linkedTopicsLoading: boolean
}
