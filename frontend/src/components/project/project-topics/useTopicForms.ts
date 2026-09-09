import { useState } from 'react'
import type { ApiTopic, ApiTopicStatus } from '@/services/project-topics.service'
import type { TopicFormsState, TopicFormFields } from './types'

type UseTopicFormsResult = {
  state: TopicFormsState
  openNewTopic: () => void
  openEditTopic: (t: ApiTopic) => void
  closeTopicForm: () => void
  buildCreateTopicPayload: () => {
    title: string
    description: string | null
    order: number
    status: ApiTopicStatus
  } | null
  buildUpdateTopicPayload: () => {
    topicId: string
    patch: {
      title: string
      description: string | null
      order: number
      status: ApiTopicStatus
    }
  } | null
}

export function useTopicForms(): UseTopicFormsResult {
  const [showNewTopic, setShowNewTopic] = useState(false)
  const [editingTopic, setEditingTopic] = useState<ApiTopic | null>(null)

  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [newTopicDescription, setNewTopicDescription] = useState('')
  const [newTopicOrder, setNewTopicOrder] = useState(0)
  const [newTopicStatus, setNewTopicStatus] = useState<ApiTopicStatus>('OPEN')
  const [newTopicError, setNewTopicError] = useState('')

  const [editTopicTitle, setEditTopicTitle] = useState('')
  const [editTopicDescription, setEditTopicDescription] = useState('')
  const [editTopicOrder, setEditTopicOrder] = useState(0)
  const [editTopicStatus, setEditTopicStatus] = useState<ApiTopicStatus>('OPEN')
  const [editTopicError, setEditTopicError] = useState('')

  const [confirmDeleteTopic, setConfirmDeleteTopic] = useState<ApiTopic | null>(null)

  const formNew: TopicFormFields = {
    title: newTopicTitle,
    setTitle: setNewTopicTitle,
    description: newTopicDescription,
    setDescription: setNewTopicDescription,
    order: newTopicOrder,
    setOrder: setNewTopicOrder,
    status: newTopicStatus,
    setStatus: setNewTopicStatus,
    error: newTopicError,
    setError: setNewTopicError,
  }

  const formEdit: TopicFormFields = {
    title: editTopicTitle,
    setTitle: setEditTopicTitle,
    description: editTopicDescription,
    setDescription: setEditTopicDescription,
    order: editTopicOrder,
    setOrder: setEditTopicOrder,
    status: editTopicStatus,
    setStatus: setEditTopicStatus,
    error: editTopicError,
    setError: setEditTopicError,
  }

  const state: TopicFormsState = {
    showNewTopic,
    setShowNewTopic,
    editingTopic,
    setEditingTopic,
    formNew,
    formEdit,
    confirmDeleteTopic,
    setConfirmDeleteTopic,
  }

  const openNewTopic = () => {
    setNewTopicTitle('')
    setNewTopicDescription('')
    setNewTopicOrder(0)
    setNewTopicStatus('OPEN')
    setNewTopicError('')
    setEditingTopic(null)
    setShowNewTopic(true)
  }

  const openEditTopic = (t: ApiTopic) => {
    setEditTopicTitle(t.title)
    setEditTopicDescription(t.description ?? '')
    setEditTopicOrder(typeof t.order === 'number' ? t.order : 0)
    setEditTopicStatus(t.status)
    setEditTopicError('')
    setEditingTopic(t)
    setShowNewTopic(true)
  }

  const closeTopicForm = () => {
    setShowNewTopic(false)
    setEditingTopic(null)
  }

  const buildCreateTopicPayload: UseTopicFormsResult['buildCreateTopicPayload'] = () => {
    const title = newTopicTitle.trim()
    const description = newTopicDescription.trim() || null
    const order = Math.max(0, Number(newTopicOrder) || 0)
    if (title.length === 0) { setNewTopicError('El título es obligatorio'); return null }
    if (title.length > 255) { setNewTopicError('Máximo 255 caracteres'); return null }
    if ((description?.length ?? 0) > 2000) { setNewTopicError('Máximo 2000 caracteres en descripción'); return null }
    setNewTopicError('')
    return { title, description, order, status: newTopicStatus }
  }

  const buildUpdateTopicPayload: UseTopicFormsResult['buildUpdateTopicPayload'] = () => {
    if (!editingTopic) return null
    const title = editTopicTitle.trim()
    const description = editTopicDescription.trim() || null
    const order = Math.max(0, Number(editTopicOrder) || 0)
    if (title.length === 0) { setEditTopicError('El título es obligatorio'); return null }
    if (title.length > 255) { setEditTopicError('Máximo 255 caracteres'); return null }
    if ((description?.length ?? 0) > 2000) { setEditTopicError('Máximo 2000 caracteres en descripción'); return null }
    setEditTopicError('')
    return { topicId: editingTopic.id, patch: { title, description, order, status: editTopicStatus } }
  }

  return {
    state,
    openNewTopic,
    openEditTopic,
    closeTopicForm,
    buildCreateTopicPayload,
    buildUpdateTopicPayload,
  }
}
