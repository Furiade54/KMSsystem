import { useState } from 'react'
import type {
  ApiContributionPriority,
  ApiContributionStatus,
  ApiContributionType,
  ApiProjectContribution,
  CreateContributionPayload,
  UpdateContributionPayload,
} from '@/services/aportes.service'
import type { AporteAttachedFileMeta, AporteFormsState, AporteFormFields } from './types'

type UseAporteFormsResult = {
  state: AporteFormsState
  openNewAporte: () => void
  openEditAporte: (a: ApiProjectContribution) => void
  closeAporteForm: () => void
  buildCreatePayload: () => CreateContributionPayload | null
  buildUpdatePayload: () => { aporteId: string; patch: UpdateContributionPayload } | null
  openLinkTopic: (a: ApiProjectContribution) => void
  closeLinkTopic: () => void
}

export function useAporteForms(): UseAporteFormsResult {
  const [showNewAporte, setShowNewAporte] = useState(false)
  const [editingAporte, setEditingAporte] = useState<ApiProjectContribution | null>(null)
  const [confirmDeleteAporte, setConfirmDeleteAporte] = useState<ApiProjectContribution | null>(null)
  const [showLinkTopicModal, setShowLinkTopicModal] = useState<{ aporteId: string; aporteTitle: string | null } | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newType, setNewType] = useState<ApiContributionType>('IDEA')
  const [newUrl, setNewUrl] = useState('')
  const [newFolderId, setNewFolderId] = useState<string | null>(null)
  const [newFileId, setNewFileId] = useState<string | null>(null)
  const [newFileMeta, setNewFileMeta] = useState<AporteAttachedFileMeta | null>(null)
  const [newUploadPercent, setNewUploadPercent] = useState(0)
  const [newUploading, setNewUploading] = useState(false)
  const [newStatus, setNewStatus] = useState<ApiContributionStatus>('PUBLICADO')
  const [newPriority, setNewPriority] = useState<ApiContributionPriority>('NORMAL')
  const [newOrder, setNewOrder] = useState(0)
  const [newPublish, setNewPublish] = useState(true)
  const [newTopicIds, setNewTopicIds] = useState<string[]>([])
  const [newError, setNewError] = useState('')

  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editType, setEditType] = useState<ApiContributionType>('IDEA')
  const [editUrl, setEditUrl] = useState('')
  const [editFolderId, setEditFolderId] = useState<string | null>(null)
  const [editFileId, setEditFileId] = useState<string | null>(null)
  const [editFileMeta, setEditFileMeta] = useState<AporteAttachedFileMeta | null>(null)
  const [editUploadPercent, setEditUploadPercent] = useState(0)
  const [editUploading, setEditUploading] = useState(false)
  const [editStatus, setEditStatus] = useState<ApiContributionStatus>('PUBLICADO')
  const [editPriority, setEditPriority] = useState<ApiContributionPriority>('NORMAL')
  const [editOrder, setEditOrder] = useState(0)
  const [editPublish, setEditPublish] = useState(false)
  const [editTopicIds, setEditTopicIds] = useState<string[]>([])
  const [editError, setEditError] = useState('')

  const formNew: AporteFormFields = {
    title: newTitle, setTitle: setNewTitle,
    content: newContent, setContent: setNewContent,
    type: newType, setType: setNewType,
    externalUrl: newUrl, setExternalUrl: setNewUrl,
    folderId: newFolderId, setFolderId: setNewFolderId,
    attachedFileId: newFileId, setAttachedFileId: setNewFileId,
    attachedFileMeta: newFileMeta, setAttachedFileMeta: setNewFileMeta,
    uploadPercent: newUploadPercent, setUploadPercent: setNewUploadPercent,
    uploading: newUploading, setUploading: setNewUploading,
    status: newStatus, setStatus: setNewStatus,
    priority: newPriority, setPriority: setNewPriority,
    order: newOrder, setOrder: setNewOrder,
    publishNow: newPublish, setPublishNow: setNewPublish,
    topicIds: newTopicIds, setTopicIds: setNewTopicIds,
    error: newError, setError: setNewError,
  }

  const formEdit: AporteFormFields = {
    title: editTitle, setTitle: setEditTitle,
    content: editContent, setContent: setEditContent,
    type: editType, setType: setEditType,
    externalUrl: editUrl, setExternalUrl: setEditUrl,
    folderId: editFolderId, setFolderId: setEditFolderId,
    attachedFileId: editFileId, setAttachedFileId: setEditFileId,
    attachedFileMeta: editFileMeta, setAttachedFileMeta: setEditFileMeta,
    uploadPercent: editUploadPercent, setUploadPercent: setEditUploadPercent,
    uploading: editUploading, setUploading: setEditUploading,
    status: editStatus, setStatus: setEditStatus,
    priority: editPriority, setPriority: setEditPriority,
    order: editOrder, setOrder: setEditOrder,
    publishNow: editPublish, setPublishNow: setEditPublish,
    topicIds: editTopicIds, setTopicIds: setEditTopicIds,
    error: editError, setError: setEditError,
  }

  const state: AporteFormsState = {
    showNewAporte, setShowNewAporte,
    editingAporte, setEditingAporte,
    formNew, formEdit,
    confirmDeleteAporte, setConfirmDeleteAporte,
    showLinkTopicModal, setShowLinkTopicModal,
  }

  const openNewAporte = () => {
    setNewTitle(''); setNewContent(''); setNewType('IDEA')
    setNewUrl(''); setNewFolderId(null); setNewFileId(null)
    setNewFileMeta(null); setNewUploadPercent(0); setNewUploading(false)
    setNewStatus('PUBLICADO'); setNewPriority('NORMAL'); setNewOrder(0)
    setNewPublish(true); setNewTopicIds([]); setNewError('')
    setEditingAporte(null); setShowNewAporte(true)
  }

  const openEditAporte = (a: ApiProjectContribution) => {
    setEditTitle(a.title ?? ''); setEditContent(a.content ?? '')
    setEditType(a.type); setEditUrl(a.externalUrl ?? '')
    setEditFolderId(a.folderId); setEditFileId(a.attachedFileId)
    setEditFileMeta(
      a.attachedFileId && (a.attachedFileName || a.attachedFileSizeBytes || a.attachedFileMimeType)
        ? {
            id: a.attachedFileId,
            name: a.attachedFileName ?? 'Archivo adjunto',
            sizeBytes: Number(a.attachedFileSizeBytes ?? 0),
            mimeType: a.attachedFileMimeType ?? null,
          }
        : null
    )
    setEditUploadPercent(0); setEditUploading(false)
    setEditStatus(a.status); setEditPriority(a.priority)
    setEditOrder(typeof a.order === 'number' ? a.order : 0)
    setEditPublish(false)
    setEditTopicIds(a.linkedTopics?.map((t) => t.id) ?? [])
    setEditError('')
    setEditingAporte(a); setShowNewAporte(true)
  }

  const closeAporteForm = () => {
    setShowNewAporte(false); setEditingAporte(null)
  }

  const openLinkTopic = (a: ApiProjectContribution) => {
    setShowLinkTopicModal({ aporteId: a.id, aporteTitle: a.title })
  }
  const closeLinkTopic = () => setShowLinkTopicModal(null)

  const buildCreatePayload: UseAporteFormsResult['buildCreatePayload'] = () => {
    const title = newTitle.trim() || null
    const content = newContent.trim() || null
    if (!title && !content) {
      setNewError('Se requiere al menos título o contenido'); return null
    }
    if (newType === 'ENLACE' && !newUrl.trim()) {
      setNewError('El tipo ENLACE requiere URL externa'); return null
    }
    if ((newType === 'ARCHIVO' || newType === 'IMAGEN') && !newFileId) {
      setNewError(`El tipo ${newType} requiere subir un archivo adjunto`); return null
    }
    if (title && title.length > 255) {
      setNewError('Título demasiado largo (255)'); return null
    }
    if (content && content.length > 8000) {
      setNewError('Contenido demasiado largo (8000)'); return null
    }
    setNewError('')
    const payload: CreateContributionPayload = {
      title,
      content,
      type: newType,
      externalUrl: newType === 'ENLACE' ? newUrl.trim() || null : newUrl.trim() || null,
      folderId: newFolderId,
      attachedFileId: newFileId,
      status: newStatus,
      priority: newPriority,
      order: Number.isFinite(newOrder) ? newOrder : 0,
      publishNow: newPublish,
      topicIds: newTopicIds.length ? newTopicIds : null,
    }
    return payload
  }

  const buildUpdatePayload: UseAporteFormsResult['buildUpdatePayload'] = () => {
    if (!editingAporte) return null
    const title = editTitle.trim()
    const content = editContent.trim()
    if (!title && !content) {
      setEditError('Se requiere al menos título o contenido'); return null
    }
    const effType = editType ?? editingAporte.type
    if (effType === 'ENLACE' && !editUrl.trim()) {
      setEditError('El tipo ENLACE requiere URL externa'); return null
    }
    if ((effType === 'ARCHIVO' || effType === 'IMAGEN') && !editFileId) {
      setEditError(`El tipo ${effType} requiere subir un archivo adjunto`); return null
    }
    setEditError('')
    const patch: UpdateContributionPayload = {
      title: title !== (editingAporte.title ?? '') ? (title || null) : undefined,
      content: content !== (editingAporte.content ?? '') ? (content || null) : undefined,
      type: effType !== editingAporte.type ? effType : undefined,
      externalUrl: editUrl.trim() !== (editingAporte.externalUrl ?? '')
        ? (editUrl.trim() || null) : undefined,
      folderId: editFolderId !== editingAporte.folderId ? editFolderId : undefined,
      attachedFileId: editFileId !== editingAporte.attachedFileId ? editFileId : undefined,
      status: editStatus !== editingAporte.status ? editStatus : undefined,
      priority: editPriority !== editingAporte.priority ? editPriority : undefined,
      order: Number(editOrder) !== Number(editingAporte.order)
        ? (Number.isFinite(editOrder) ? editOrder : 0) : undefined,
      publishNow: editPublish === true ? true : undefined,
    }
    return { aporteId: editingAporte.id, patch }
  }

  return {
    state,
    openNewAporte, openEditAporte, closeAporteForm,
    buildCreatePayload, buildUpdatePayload,
    openLinkTopic, closeLinkTopic,
  }
}
