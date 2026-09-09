import { useState } from 'react'
import type { FileVersionUiState } from './types'

export function useFileVersionForms(): FileVersionUiState {
  const [uploadComment, setUploadComment] = useState<string>('')
  const [showUpload, setShowUpload] = useState<boolean>(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  const toggleShowUpload = () => {
    setShowUpload((prev) => !prev)
    if (showUpload) {
      setUploadFile(null)
      setUploadComment('')
      setUploadError(null)
    }
  }

  return {
    uploadComment,
    setUploadComment,
    showUpload,
    toggleShowUpload,
    uploadError,
    setUploadError,
    uploadFile,
    setUploadFile,
  }
}
