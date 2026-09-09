import type { ApiFileVersion } from '../../../services/files.service'

export interface FileVersionMutationsPending {
  uploadVersion: boolean
  setCurrentVersion: boolean
  deleteVersion: boolean
}

export interface FileVersionCallbacks {
  onSetCurrent: (versionId: string) => Promise<void> | void
  onDelete: (versionId: string) => Promise<void> | void
  onDownload: (version: ApiFileVersion) => void
  onUploadNew: (file: File, comment: string | null) => Promise<void> | void
  canManage: boolean
  canEdit: boolean
}

export interface FileVersionUiState {
  uploadComment: string
  setUploadComment: (v: string) => void
  showUpload: boolean
  toggleShowUpload: () => void
  uploadError: string | null
  setUploadError: (v: string | null) => void
  uploadFile: File | null
  setUploadFile: (v: File | null) => void
}
