import type { ApiTopic, ApiTopicItem, ApiTopicItemStatus, ApiTopicStatus } from '@/services/project-topics.service'

export type TopicFiltersState = {
  topicsSearch: string
  setTopicsSearch: (v: string) => void
  topicsStatusFilter: ApiTopicStatus | ''
  setTopicsStatusFilter: (v: ApiTopicStatus | '') => void
  topicsPage: number
  setTopicsPage: (v: number | ((p: number) => number)) => void
  topicsPageSize: number
}

export type TopicItemFiltersState = {
  topicItemsSearch: string
  setTopicItemsSearch: (v: string) => void
  topicItemsStatusFilter: ApiTopicItemStatus | ''
  setTopicItemsStatusFilter: (v: ApiTopicItemStatus | '') => void
  topicItemsPage: number
  topicItemsPageSize: number
}

export type TopicFormFields = {
  title: string
  setTitle: (v: string) => void
  description: string
  setDescription: (v: string) => void
  order: number
  setOrder: (v: number) => void
  status: ApiTopicStatus
  setStatus: (v: ApiTopicStatus) => void
  error: string
  setError: (v: string) => void
}

export type TopicFormsState = {
  showNewTopic: boolean
  setShowNewTopic: (v: boolean) => void
  editingTopic: ApiTopic | null
  setEditingTopic: (v: ApiTopic | null) => void
  formNew: TopicFormFields
  formEdit: TopicFormFields
  confirmDeleteTopic: ApiTopic | null
  setConfirmDeleteTopic: (m: ApiTopic | null) => void
}

export type TopicItemFormFields = {
  title: string
  setTitle: (v: string) => void
  description: string
  setDescription: (v: string) => void
  order: number
  setOrder: (v: number) => void
  status: ApiTopicItemStatus
  setStatus: (v: ApiTopicItemStatus) => void
  assignedMembers: string[]
  setAssignedMembers: (v: string[]) => void
  error: string
  setError: (v: string) => void
}

export type TopicItemFormsState = {
  expandedTopicId: string | null
  setExpandedTopicId: (v: string | null | ((p: string | null) => string | null)) => void
  showNewTopicItem: boolean
  setShowNewTopicItem: (v: boolean) => void
  editingTopicItem: ApiTopicItem | null
  setEditingTopicItem: (v: ApiTopicItem | null) => void
  formNew: TopicItemFormFields
  formEdit: TopicItemFormFields
  confirmDeleteTopicItem: ApiTopicItem | null
  setConfirmDeleteTopicItem: (m: ApiTopicItem | null) => void
}

export type TopicMemberMgmtState = {
  managingMembersForItemId: string | null
  setManagingMembersForItemId: (v: string | null | ((prev: string | null) => string | null)) => void
  manageMembersError: string
  setManageMembersError: (v: string) => void
}

export type TopicMutationsPending = {
  createTopicPending: boolean
  updateTopicPending: boolean
  deleteTopicPending: boolean
  createTopicItemPending: boolean
  updateTopicItemPending: boolean
  deleteTopicItemPending: boolean
  assignItemMemberPending: boolean
  unassignItemMemberPending: boolean
}

export type TopicItemAvailableMember = {
  projectMemberId: string
  userId: string
  userName?: string | null
  roleName?: string | null
  alreadyAssigned: boolean
  assignmentId?: string | null
}

export type TopicCallbacks = {
  onNewTopic: () => void
  onEditTopic: (topic: ApiTopic) => void
  onSubmitTopic: (e: React.FormEvent) => void
  onConfirmDeleteTopic: () => void
  onNewTopicItem: () => void
  onEditTopicItem: (item: ApiTopicItem) => void
  onSubmitTopicItem: (e: React.FormEvent) => void
  onConfirmDeleteTopicItem: () => void
  onOpenManageMembersForItem: (item: ApiTopicItem) => void
  onAssignItemMember: (projectMemberId: string) => void
  onUnassignItemMember: (assignmentId: string) => void
}
