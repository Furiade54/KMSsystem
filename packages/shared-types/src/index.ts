// ============================================================
// KMS - Tipos compartidos del dominio
// ============================================================

// --- Identidad y seguridad ---

export type EntityStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DELETED' | 'BLOCKED' | 'PENDING'

export const DB_ENTITY_STATUS = {
  ACTIVO: 'ACTIVE' as EntityStatus,
  INACTIVO: 'INACTIVE' as EntityStatus,
  SUSPENDIDO: 'SUSPENDED' as EntityStatus,
  ELIMINADO: 'DELETED' as EntityStatus,
  BLOQUEADO: 'BLOCKED' as EntityStatus,
  PENDIENTE: 'PENDING' as EntityStatus,
} as const

export type DbEntityStatus = keyof typeof DB_ENTITY_STATUS

export interface Organization {
  id: string
  name: string
  taxId?: string | null
  logoUrl?: string | null
  status: EntityStatus
  createdAt: string
  updatedAt?: string | null
}

export interface User {
  id: string
  organizationId: string
  fullName: string | null
  email: string
  passwordHash?: string
  avatarUrl: string | null
  phone?: string | null
  position?: string | null
  status: EntityStatus
  lastLogin?: string | null
  createdAt: string
  updatedAt?: string | null
  roles?: Array<{ id: string; name: string; isSystemRole: boolean; priorityLevel?: number; assignedAt?: string | null; assignedBy?: string | null }>
  isOrgAdmin?: boolean
}

export interface RolePermission {
  id: string
  code: PermissionCode
  description?: string | null
  category?: string | null
  level?: PermissionLevel | null
}

export type PermissionLevel = 'ORGANIZACION' | 'PROYECTO' | 'RECURSO' | 'SISTEMA'

export interface Role {
  id: string
  organizationId?: string | null
  name: string
  description?: string | null
  isSystemRole: boolean
  priorityLevel: number
  createdAt: string
  updatedAt?: string | null
  permissions?: RolePermission[]
  usersCount?: number
}

export interface CreateRoleDto {
  name: string
  description?: string | null
  priorityLevel?: number
  permissionCodes?: PermissionCode[]
}

export interface UpdateRoleDto {
  name?: string
  description?: string | null
  priorityLevel?: number
}

export interface SetRolePermissionsDto {
  permissionCodes: PermissionCode[]
}

export interface UserRole {
  id: string
  userId: string
  roleId: string
  organizationId: string
  assignedAt?: string | null
  assignedBy?: string | null
}

export interface RoleAssignment {
  id: string
  userId: string
  roleId: string
  roleName: string
  roleDescription?: string | null
  isSystemRole: boolean
  priorityLevel?: number
  assignedAt?: string | null
  assignedBy?: string | null
  assignedByName?: string | null
}

export interface CreateUserDto {
  fullName: string
  email: string
  password?: string
  phone?: string | null
  position?: string | null
  status?: EntityStatus
  roleIds?: string[]
}

export interface UpdateUserDto {
  fullName?: string
  email?: string
  phone?: string | null
  position?: string | null
  avatarUrl?: string | null
  status?: EntityStatus
  password?: string
  roleIds?: string[]
}

export interface CreateOrganizationDto {
  name: string
  taxId?: string | null
  logoUrl?: string | null
  status?: EntityStatus
}

export interface UpdateOrganizationDto {
  name?: string
  taxId?: string | null
  logoUrl?: string | null
  status?: EntityStatus
}

export type ResourceCapability =
  | 'VER'
  | 'DESCARGAR'
  | 'COMENTAR'
  | 'EDITAR'
  | 'COMPARTIR'
  | 'ADMINISTRAR'

export type ResourceTypeDb = 'proyecto' | 'carpeta' | 'archivo' | 'aporte'
export type ResourceTypeApi = 'PROJECT' | 'FOLDER' | 'FILE' | 'APORTE'

export const RESOURCE_TYPE_DB_TO_API: Record<ResourceTypeDb, ResourceTypeApi> = {
  proyecto: 'PROJECT',
  carpeta: 'FOLDER',
  archivo: 'FILE',
  aporte: 'APORTE',
}

export const RESOURCE_TYPE_API_TO_DB: Record<ResourceTypeApi, ResourceTypeDb> = {
  PROJECT: 'proyecto',
  FOLDER: 'carpeta',
  FILE: 'archivo',
  APORTE: 'aporte',
}

export const RESOURCE_CAPABILITY_TO_COLUMN: Record<ResourceCapability, string> = {
  VER: 'PuedeVer',
  DESCARGAR: 'PuedeDescargar',
  COMENTAR: 'PuedeComentar',
  EDITAR: 'PuedeEditar',
  COMPARTIR: 'PuedeCompartir',
  ADMINISTRAR: 'PuedeAdministrar',
}

export interface ResourcePermissionGrant {
  id: string
  resourceType: ResourceTypeApi
  resourceId: string
  userId?: string | null
  userName?: string | null
  userEmail?: string | null
  roleId?: string | null
  roleName?: string | null
  puedeVer: boolean
  puedeDescargar: boolean
  puedeComentar: boolean
  puedeEditar: boolean
  puedeCompartir: boolean
  puedeAdministrar: boolean
  createdAt: string
  grantedByUserId?: string | null
  grantedByUserName?: string | null
}

export type ResourceGrantee =
  | { userId: string; roleId?: null | undefined }
  | { roleId: string; userId?: null | undefined }

export type CreateResourcePermissionDto = ResourceGrantee & {
  puedeVer: boolean
  puedeDescargar?: boolean
  puedeComentar?: boolean
  puedeEditar?: boolean
  puedeCompartir?: boolean
  puedeAdministrar?: boolean
}

export type UpdateResourcePermissionDto = {
  puedeVer?: boolean
  puedeDescargar?: boolean
  puedeComentar?: boolean
  puedeEditar?: boolean
  puedeCompartir?: boolean
  puedeAdministrar?: boolean
}

export interface ListResourcePermissionsParams {
  page?: number
  pageSize?: number
  search?: string
  scope?: 'all' | 'users' | 'roles'
}

export interface Permission {
  id: string
  code: PermissionCode
  description?: string | null
}

export type PermissionCode =
  | 'org.ver'
  | 'org.editar'
  | 'org.crear'
  | 'org.eliminar'
  | 'org.eliminar_permanente'
  | 'org.listar'
  | 'usuarios.ver'
  | 'usuarios.crear'
  | 'usuarios.editar'
  | 'usuarios.eliminar'
  | 'roles.ver'
  | 'roles.asignar'
  | 'roles.crear'
  | 'roles.editar'
  | 'roles.eliminar'
  | 'solicitudes.gestionar'
  | 'proyectos.ver'
  | 'proyectos.crear'
  | 'proyectos.editar'
  | 'proyectos.eliminar'
  | 'proyectos.miembros.gestionar'
  | 'reuniones.ver'
  | 'reuniones.crear'
  | 'reuniones.editar'
  | 'reuniones.eliminar'
  | 'reuniones.asistentes.gestionar'
  | 'reuniones.acta.gestionar'
  | 'temas.ver'
  | 'temas.crear'
  | 'temas.editar'
  | 'temas.eliminar'
  | 'temas.items.ver'
  | 'temas.items.crear'
  | 'temas.items.editar'
  | 'temas.items.eliminar'
  | 'archivos.ver'
  | 'archivos.subir'
  | 'archivos.editar'
  | 'archivos.eliminar'
  | 'archivos.compartir'
  | 'comentarios.crear'
  | 'comentarios.gestionar'
  | 'favoritos.gestionar'
  | 'auditoria.ver'
  | 'revisiones.crear'
  | 'revisiones.asignar'
  | 'revisiones.ver'
  | 'recursos.permisos.ver'
  | 'recursos.permisos.editar'
  | 'aportes.ver'
  | 'aportes.crear'
  | 'aportes.editar'
  | 'aportes.eliminar'
  | 'aportes.compartir'

export const PERMISSION_CODES: ReadonlySet<PermissionCode> = new Set<PermissionCode>([
  'org.ver',
  'org.editar',
  'org.crear',
  'org.eliminar',
  'org.eliminar_permanente',
  'org.listar',
  'usuarios.ver',
  'usuarios.crear',
  'usuarios.editar',
  'usuarios.eliminar',
  'roles.ver',
  'roles.asignar',
  'roles.crear',
  'roles.editar',
  'roles.eliminar',
  'solicitudes.gestionar',
  'proyectos.ver',
  'proyectos.crear',
  'proyectos.editar',
  'proyectos.eliminar',
  'proyectos.miembros.gestionar',
  'reuniones.ver',
  'reuniones.crear',
  'reuniones.editar',
  'reuniones.eliminar',
  'reuniones.asistentes.gestionar',
  'reuniones.acta.gestionar',
  'temas.ver',
  'temas.crear',
  'temas.editar',
  'temas.eliminar',
  'temas.items.ver',
  'temas.items.crear',
  'temas.items.editar',
  'temas.items.eliminar',
  'archivos.ver',
  'archivos.subir',
  'archivos.editar',
  'archivos.eliminar',
  'archivos.compartir',
  'comentarios.crear',
  'comentarios.gestionar',
  'favoritos.gestionar',
  'auditoria.ver',
  'revisiones.crear',
  'revisiones.asignar',
  'revisiones.ver',
  'recursos.permisos.ver',
  'recursos.permisos.editar',
  'aportes.ver',
  'aportes.crear',
  'aportes.editar',
  'aportes.eliminar',
  'aportes.compartir',
])

// --- Trabajo colaborativo ---

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED' | 'COMPLETED' | 'DRAFT' | 'PENDING' | 'INACTIVE'

export const DB_PROJECT_STATUS = {
  ACTIVO: 'ACTIVE' as ProjectStatus,
  INACTIVO: 'INACTIVE' as ProjectStatus,
  PENDIENTE: 'PENDING' as ProjectStatus,
  BORRADOR: 'DRAFT' as ProjectStatus,
  ARCHIVADO: 'ARCHIVED' as ProjectStatus,
  COMPLETADO: 'COMPLETED' as ProjectStatus,
} as const

export type DbProjectStatus = keyof typeof DB_PROJECT_STATUS

export interface Project {
  id: string
  organizationId: string
  name: string
  description?: string | null
  status: ProjectStatus
  ownerId?: string | null
  docMaestroCarpetaId?: string | null
  docMaestroArchivoId?: string | null
  progressPercentage: number
  createdAt: string
  updatedAt?: string | null
}

export interface DesignateMasterDocPayload {
  resourceType: 'FOLDER' | 'FILE'
  resourceId: string
}

export interface ProjectMasterDocInfo {
  resourceType: 'FOLDER' | 'FILE'
  resourceId: string
  name: string
  path: string
  size?: number | null
  lastUpdatedAt?: string | null
  ownerId?: string | null
  ownerName?: string | null
}

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  roleName?: string | null
  joinedAt: string
}

export type TopicStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED' | 'IN_PROGRESS'

export const DB_TOPIC_STATUS = {
  ABIERTO: 'OPEN' as TopicStatus,
  EN_REVISION: 'IN_REVIEW' as TopicStatus,
  RESUELTO: 'RESOLVED' as TopicStatus,
  CERRADO: 'CLOSED' as TopicStatus,
  EN_PROGRESO: 'IN_PROGRESS' as TopicStatus,
} as const

export type DbTopicStatus = keyof typeof DB_TOPIC_STATUS

export interface ProjectTopic {
  id: string
  projectId: string
  title: string
  description?: string | null
  createdBy?: string | null
  status: TopicStatus
  order: number
  percentage: number
  createdAt: string
  updatedAt?: string | null
}

export type TopicItemStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED'

export const DB_TOPIC_ITEM_STATUS = {
  PENDIENTE: 'PENDING' as TopicItemStatus,
  EN_PROGRESO: 'IN_PROGRESS' as TopicItemStatus,
  COMPLETADO: 'COMPLETED' as TopicItemStatus,
  BLOQUEADO: 'BLOCKED' as TopicItemStatus,
} as const

export type DbTopicItemStatus = keyof typeof DB_TOPIC_ITEM_STATUS

export interface ProjectTopicItem {
  id: string
  topicId: string
  title: string
  description?: string | null
  status: TopicItemStatus
  order: number
  assignedMemberIds: string[]
  assignedMembers?: Array<{
    assignmentId: string
    projectMemberId: string
    userId: string
    userName?: string | null
    roleName?: string | null
    assignedAt: string
  }>
  createdAt: string
  updatedAt?: string | null
}

export interface ProjectTopicItemMember {
  id: string
  topicItemId: string
  projectMemberId: string
  assignedAt: string
}

export interface ProjectTopicItemFile {
  id: string
  topicItemId: string
  fileId: string
  fileName?: string | null
  fileSizeBytes?: number | null
  fileMimeType?: string | null
  linkedByUserId?: string | null
  linkedByUserName?: string | null
  linkedAt: string
}

export type MeetingStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'HELD'

export const DB_MEETING_STATUS = {
  PROGRAMADA: 'SCHEDULED' as MeetingStatus,
  EN_CURSO: 'IN_PROGRESS' as MeetingStatus,
  REALIZADA: 'HELD' as MeetingStatus,
  COMPLETADA: 'COMPLETED' as MeetingStatus,
  CANCELADA: 'CANCELLED' as MeetingStatus,
} as const

export type DbMeetingStatus = keyof typeof DB_MEETING_STATUS

export interface Meeting {
  id: string
  projectId: string
  title: string
  description?: string | null
  meetingAt?: string | null
  createdBy?: string | null
  minutesFileId?: string | null
  status: MeetingStatus
  createdAt: string
  updatedAt?: string | null
  linkedTopicsIds?: string[]
}

export interface MeetingLinkedTopic {
  topicId: string
  title: string
  linkedAt: string
  linkedByUserId?: string | null
  linkedByUserName?: string | null
}

export interface MeetingParticipant {
  meetingId: string
  userId: string
  roleName?: string | null
  attended: boolean
}

export interface MeetingMinutes {
  id: string
  meetingId: string
  createdBy?: string | null
  content?: string | null
  title?: string | null
  state: 'BORRADOR' | 'FINALIZADO' | 'OBSOLETO'
  finalizedAt?: string | null
  createdAt: string
  updatedAt?: string | null
}

export type MeetingAgendaItemState =
  | 'PENDIENTE'
  | 'EN_CURSO'
  | 'COMPLETADO'
  | 'OMITIDO'
  | 'DIFERIDO'

export interface MeetingAgendaItem {
  id: string
  meetingId: string
  parentId: string | null
  order: number
  title: string
  description: string | null
  estimatedMinutes: number | null
  state: MeetingAgendaItemState
  responsibleUserId: string | null
  createdAt: string
  updatedAt: string | null
}


// --- Recursos ---

export interface Folder {
  id: string
  projectId: string
  parentFolderId?: string | null
  ownerId?: string | null
  name: string
  inheritPermissions: boolean
  createdAt: string
  updatedAt?: string | null
}

export interface File {
  id: string
  folderId?: string | null
  projectId?: string | null
  ownerId?: string | null
  name: string
  extension?: string | null
  mimeType?: string | null
  currentVersionId?: string | null
  size?: number | null
  inheritPermissions: boolean
  createdAt: string
  updatedAt?: string | null
}

export interface FileVersion {
  id: string
  fileId: string
  versionNumber: number
  s3Bucket?: string | null
  s3Key?: string | null
  hash?: string | null
  uploadedBy?: string | null
  comment?: string | null
  size?: number | null
  createdAt: string
}

export type ProjectContributionType =
  | 'IDEA'
  | 'COMENTARIO'
  | 'ENLACE'
  | 'ARCHIVO'
  | 'IMAGEN'
  | 'ENCUESTA'
  | 'MENSAJE'
  | 'OTRO'

export type ProjectContributionStatus =
  | 'BORRADOR'
  | 'PUBLICADO'
  | 'OCULTO'
  | 'ELIMINADO'
  | 'DESTACADO'

export type ProjectContributionPriority =
  | 'BAJA'
  | 'NORMAL'
  | 'ALTA'
  | 'URGENTE'

export interface ProjectContribution {
  id: string
  organizationId: string
  projectId: string
  authorId?: string | null
  authorName?: string | null
  authorEmail?: string | null
  title?: string | null
  content?: string | null
  type: ProjectContributionType
  externalUrl?: string | null
  folderId?: string | null
  attachedFileId?: string | null
  attachedFileName?: string | null
  attachedFileSizeBytes?: number | null
  attachedFileMimeType?: string | null
  status: ProjectContributionStatus
  priority: ProjectContributionPriority
  order: number
  likesCount: number
  commentsCount: number
  createdAt: string
  updatedAt?: string | null
  publishedAt?: string | null
  linkedTopics?: Array<{
    id: string
    title: string
    linkedAt: string
    linkedBy?: string | null
  }>
  _permissions?: {
    canEdit: boolean
    canDelete: boolean
    canShare: boolean
  }
}

export interface ProjectContributionTopicLink {
  contributionId: string
  topicId: string
  topicTitle?: string | null
  linkedByUserId?: string | null
  linkedAt: string
}

export interface ExternalResource {
  id: string
  projectId: string
  folderId?: string | null
  title?: string | null
  url: string
  type?: string | null
  createdBy?: string | null
  createdAt: string
}

// --- Acceso y compartición ---

export type ResourceType =
  | 'ORGANIZATION'
  | 'PROJECT'
  | 'FOLDER'
  | 'FILE'
  | 'TOPIC'
  | 'MEETING'
  | 'MEETING_MINUTES'
  | 'COMMENT'
  | 'EXTERNAL'

export interface ResourcePermissions {
  id: string
  resourceType: ResourceType
  resourceId: string
  userId?: string | null
  roleId?: string | null
  canView: boolean
  canDownload: boolean
  canComment: boolean
  canEdit: boolean
  canShare: boolean
  canAdmin: boolean
}

export interface Share {
  id: string
  resourceType: ResourceType
  resourceId: string
  sharedBy: string
  sharedWithUser?: string | null
  expiresAt?: string | null
  sharedAt: string
}

export type AccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export const DB_ACCESS_STATUS = {
  PENDIENTE: 'PENDING' as AccessRequestStatus,
  APROBADO: 'APPROVED' as AccessRequestStatus,
  RECHAZADO: 'REJECTED' as AccessRequestStatus,
} as const

export type DbAccessRequestStatus = keyof typeof DB_ACCESS_STATUS

export interface AccessRequest {
  id: string
  resourceType: ResourceType
  resourceId: string
  requestedBy: string
  ownerId?: string | null
  message?: string | null
  status: AccessRequestStatus
  resolvedAt?: string | null
  createdAt: string
}

// --- Conocimiento y colaboración ---

export interface Comment {
  id: string
  resourceType: ResourceType
  resourceId: string
  userId: string
  parentCommentId?: string | null
  content: string
  isResolved: boolean
  createdAt: string
  updatedAt?: string | null
}

export type MentionType = 'USER' | 'FILE' | 'FOLDER' | 'PROJECT'

export interface Mention {
  id: string
  commentId: string
  mentionType: MentionType
  mentionId: string
  createdAt: string
}

export type ReviewStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'

export const DB_REVIEW_STATUS = {
  BORRADOR: 'DRAFT' as ReviewStatus,
  EN_REVISION: 'IN_REVIEW' as ReviewStatus,
  CAMBIOS_SOLICITADOS: 'CHANGES_REQUESTED' as ReviewStatus,
  APROBADO: 'APPROVED' as ReviewStatus,
  RECHAZADO: 'REJECTED' as ReviewStatus,
} as const

export type DbReviewStatus = keyof typeof DB_REVIEW_STATUS

export interface Review {
  id: string
  resourceId: string
  resourceType: ResourceType
  requestedBy: string
  reviewerId: string
  status: ReviewStatus
  comments?: string | null
  deadline?: string | null
  createdAt: string
  resolvedAt?: string | null
}

export interface Notification {
  id: string
  userId: string
  type?: string | null
  title?: string | null
  message?: string | null
  relatedResourceType?: ResourceType | null
  relatedResourceId?: string | null
  isRead: boolean
  createdAt: string
}

export interface Tag {
  id: string
  organizationId: string
  name: string
  color?: string | null
}

export interface Favorite {
  userId: string
  resourceType: ResourceType
  resourceId: string
  createdAt: string
}

// --- Trazabilidad ---

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'PROJECT_DELETED'
  | 'FOLDER_CREATED'
  | 'FOLDER_UPDATED'
  | 'FOLDER_DELETED'
  | 'FILE_UPLOADED'
  | 'FILE_VERSION_CREATED'
  | 'FILE_DOWNLOADED'
  | 'FILE_DELETED'
  | 'COMMENT_CREATED'
  | 'COMMENT_UPDATED'
  | 'MENTION_CREATED'
  | 'PERMISSION_CHANGED'
  | 'SHARE_CREATED'
  | 'ACCESS_REQUESTED'
  | 'ACCESS_APPROVED'
  | 'ACCESS_REJECTED'
  | 'REVIEW_REQUESTED'
  | 'REVIEW_APPROVED'
  | 'REVIEW_REJECTED'
  | 'DOCUMENT_APPROVED'

export interface AuditLog {
  id: string
  organizationId?: string | null
  userId?: string | null
  action: AuditAction | string
  resourceType?: ResourceType | null
  resourceId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: string | null
  createdAt: string
}

// --- DTOs y contratos API ---

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
  expiresAt: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  error?: string
  errors?: Record<string, string[]>
  duplicated?: boolean
}

export interface PaginationParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// --- Enums visuales para UI ---

export type WorkflowStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'ARCHIVED'

export const DB_WORKFLOW_STATUS = {
  BORRADOR: 'DRAFT' as WorkflowStatus,
  EN_PROGRESO: 'IN_PROGRESS' as WorkflowStatus,
  EN_REVISION: 'IN_REVIEW' as WorkflowStatus,
  CAMBIOS_SOLICITADOS: 'CHANGES_REQUESTED' as WorkflowStatus,
  APROBADO: 'APPROVED' as WorkflowStatus,
  PUBLICADO: 'PUBLISHED' as WorkflowStatus,
  ARCHIVADO: 'ARCHIVED' as WorkflowStatus,
} as const

export type DbWorkflowStatus = keyof typeof DB_WORKFLOW_STATUS

export interface WorkflowState {
  status: WorkflowStatus
  displayName: string
  color: 'gray' | 'blue' | 'yellow' | 'green' | 'red' | 'purple'
}

export const WORKFLOW_STATES: WorkflowState[] = [
  { status: 'DRAFT', displayName: 'Borrador', color: 'gray' },
  { status: 'IN_PROGRESS', displayName: 'En construcción', color: 'blue' },
  { status: 'IN_REVIEW', displayName: 'En revisión', color: 'yellow' },
  { status: 'CHANGES_REQUESTED', displayName: 'Correcciones', color: 'yellow' },
  { status: 'APPROVED', displayName: 'Aprobado', color: 'green' },
  { status: 'PUBLISHED', displayName: 'Publicado', color: 'green' },
  { status: 'ARCHIVED', displayName: 'Archivado', color: 'gray' },
]
