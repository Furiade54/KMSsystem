import { useState } from 'react'
import type { ApiTopicItem, ApiTopicItemStatus } from '@/services/project-topics.service'
import type { TopicItemFormsState, TopicItemFormFields, TopicMemberMgmtState } from './types'

type UseTopicItemFormsResult = {
  state: TopicItemFormsState
  memberState: TopicMemberMgmtState
  resetNewTopicItemForm: () => void
  resetEditTopicItemForm: () => void
  openNewTopicItem: () => void
  openEditTopicItem: (item: ApiTopicItem) => void
  closeTopicItemForm: () => void
  openManageMembersForItem: (item: ApiTopicItem) => void
  closeManageMembers: () => void
  buildCreateTopicItemPayload: () => {
    topicId: string
    title: string
    description: string | null
    order: number
    status: ApiTopicItemStatus
    assignedMemberIds: string[]
  } | null
  buildUpdateTopicItemPayload: () => {
    topicId: string
    itemId: string
    patch: {
      title: string
      description: string | null
      order: number
      status: ApiTopicItemStatus
      assignedMemberIds: string[]
    }
  } | null
}

export function useTopicItemForms(): UseTopicItemFormsResult {
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null)

  const [showNewTopicItem, setShowNewTopicItem] = useState(false)
  const [editingTopicItem, setEditingTopicItem] = useState<ApiTopicItem | null>(null)

  const [newTopicItemTitle, setNewTopicItemTitle] = useState('')
  const [newTopicItemDescription, setNewTopicItemDescription] = useState('')
  const [newTopicItemOrder, setNewTopicItemOrder] = useState(0)
  const [newTopicItemStatus, setNewTopicItemStatus] = useState<ApiTopicItemStatus>('PENDING')
  const [newTopicItemAssignedMembers, setNewTopicItemAssignedMembers] = useState<string[]>([])
  const [newTopicItemError, setNewTopicItemError] = useState('')

  const [editTopicItemTitle, setEditTopicItemTitle] = useState('')
  const [editTopicItemDescription, setEditTopicItemDescription] = useState('')
  const [editTopicItemOrder, setEditTopicItemOrder] = useState(0)
  const [editTopicItemStatus, setEditTopicItemStatus] = useState<ApiTopicItemStatus>('PENDING')
  const [editTopicItemAssignedMembers, setEditTopicItemAssignedMembers] = useState<string[]>([])
  const [editTopicItemError, setEditTopicItemError] = useState('')

  const [confirmDeleteTopicItem, setConfirmDeleteTopicItem] = useState<ApiTopicItem | null>(null)

  const [managingMembersForItemId, setManagingMembersForItemId] = useState<string | null>(null)
  const [manageMembersError, setManageMembersError] = useState('')

  const formNew: TopicItemFormFields = {
    title: newTopicItemTitle,
    setTitle: setNewTopicItemTitle,
    description: newTopicItemDescription,
    setDescription: setNewTopicItemDescription,
    order: newTopicItemOrder,
    setOrder: setNewTopicItemOrder,
    status: newTopicItemStatus,
    setStatus: setNewTopicItemStatus,
    assignedMembers: newTopicItemAssignedMembers,
    setAssignedMembers: setNewTopicItemAssignedMembers,
    error: newTopicItemError,
    setError: setNewTopicItemError,
  }

  const formEdit: TopicItemFormFields = {
    title: editTopicItemTitle,
    setTitle: setEditTopicItemTitle,
    description: editTopicItemDescription,
    setDescription: setEditTopicItemDescription,
    order: editTopicItemOrder,
    setOrder: setEditTopicItemOrder,
    status: editTopicItemStatus,
    setStatus: setEditTopicItemStatus,
    assignedMembers: editTopicItemAssignedMembers,
    setAssignedMembers: setEditTopicItemAssignedMembers,
    error: editTopicItemError,
    setError: setEditTopicItemError,
  }

  const state: TopicItemFormsState = {
    expandedTopicId,
    setExpandedTopicId,
    showNewTopicItem,
    setShowNewTopicItem,
    editingTopicItem,
    setEditingTopicItem,
    formNew,
    formEdit,
    confirmDeleteTopicItem,
    setConfirmDeleteTopicItem,
  }

  const memberState: TopicMemberMgmtState = {
    managingMembersForItemId,
    setManagingMembersForItemId,
    manageMembersError,
    setManageMembersError,
  }

  const resetNewTopicItemForm = () => {
    setNewTopicItemTitle('')
    setNewTopicItemDescription('')
    setNewTopicItemOrder(0)
    setNewTopicItemStatus('PENDING')
    setNewTopicItemAssignedMembers([])
    setNewTopicItemError('')
  }

  const resetEditTopicItemForm = () => {
    setEditTopicItemTitle('')
    setEditTopicItemDescription('')
    setEditTopicItemOrder(0)
    setEditTopicItemStatus('PENDING')
    setEditTopicItemAssignedMembers([])
    setEditTopicItemError('')
  }

  const openNewTopicItem = () => {
    resetNewTopicItemForm()
    setEditingTopicItem(null)
    setShowNewTopicItem(true)
  }

  const openEditTopicItem = (item: ApiTopicItem) => {
    setEditTopicItemTitle(item.title)
    setEditTopicItemDescription(item.description ?? '')
    setEditTopicItemOrder(typeof item.order === 'number' ? item.order : 0)
    setEditTopicItemStatus(item.status)
    setEditTopicItemAssignedMembers([...(item.assignedMemberIds ?? [])])
    setEditTopicItemError('')
    setEditingTopicItem(item)
    setShowNewTopicItem(true)
  }

  const closeTopicItemForm = () => {
    setShowNewTopicItem(false)
    setEditingTopicItem(null)
  }

  const openManageMembersForItem = (item: ApiTopicItem) => {
    setManageMembersError('')
    setManagingMembersForItemId(item.id)
  }

  const closeManageMembers = () => {
    setManagingMembersForItemId(null)
    setManageMembersError('')
  }

  const buildCreateTopicItemPayload: UseTopicItemFormsResult['buildCreateTopicItemPayload'] = () => {
    const topicId = expandedTopicId
    if (!topicId) return null
    const title = newTopicItemTitle.trim()
    const description = newTopicItemDescription.trim() || null
    const order = Math.max(0, Number(newTopicItemOrder) || 0)
    const assignedMemberIds = newTopicItemAssignedMembers
    if (title.length === 0) { setNewTopicItemError('El título es obligatorio'); return null }
    if (title.length > 255) { setNewTopicItemError('Máximo 255 caracteres'); return null }
    if ((description?.length ?? 0) > 2000) { setNewTopicItemError('Máximo 2000 caracteres en descripción'); return null }
    setNewTopicItemError('')
    return { topicId, title, description, order, status: newTopicItemStatus, assignedMemberIds }
  }

  const buildUpdateTopicItemPayload: UseTopicItemFormsResult['buildUpdateTopicItemPayload'] = () => {
    const topicId = expandedTopicId
    if (!topicId || !editingTopicItem) return null
    const title = editTopicItemTitle.trim()
    const description = editTopicItemDescription.trim() || null
    const order = Math.max(0, Number(editTopicItemOrder) || 0)
    const assignedMemberIds = editTopicItemAssignedMembers
    if (title.length === 0) { setEditTopicItemError('El título es obligatorio'); return null }
    if (title.length > 255) { setEditTopicItemError('Máximo 255 caracteres'); return null }
    if ((description?.length ?? 0) > 2000) { setEditTopicItemError('Máximo 2000 caracteres en descripción'); return null }
    setEditTopicItemError('')
    return {
      topicId,
      itemId: editingTopicItem.id,
      patch: { title, description, order, status: editTopicItemStatus, assignedMemberIds },
    }
  }

  return {
    state,
    memberState,
    resetNewTopicItemForm,
    resetEditTopicItemForm,
    openNewTopicItem,
    openEditTopicItem,
    closeTopicItemForm,
    openManageMembersForItem,
    closeManageMembers,
    buildCreateTopicItemPayload,
    buildUpdateTopicItemPayload,
  }
}
