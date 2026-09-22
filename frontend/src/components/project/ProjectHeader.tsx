import type { MutableRefObject } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import {
  FolderKanban,
  ChevronRight,
  Star,
  UserPlus,
  Loader2,
  Upload,
  MoreHorizontal,
  Edit3,
  Trash2,
} from 'lucide-react'
import type { FavoriteResourceType } from '@/services/favorites.service'

type TabDef = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export type ProjectHeaderProps = {
  detailIsLoading: boolean
  project: {
    id?: string
    name?: string
    color?: string | null
    membersCount?: number
    status?: string
    updatedAt?: string | null
    createdAt?: string | null
    progressPercentage?: number | null
  } | null | undefined
  projectGradientClass: (color?: string | null) => string
  headerBadge: { bgClass: string; textClass: string; label: string } | null
  ownerNameText: string
  stats?: { membersCount?: number } | null
  formatRelativeTime: (iso: string | null | undefined) => string
  isLocalFavorite: (rt: FavoriteResourceType, id: string) => boolean | undefined
  handleToggleFavorite: (rt: FavoriteResourceType, id: string, currentLocal?: boolean) => void
  canManageMembers: boolean
  setShowInviteMember: (v: boolean) => void
  setInviteSelectedUserId: (v: string | null) => void
  setInviteSearch: (v: string) => void
  setInviteError: (v: string) => void
  isUploading: boolean
  uploadPercent: number
  fileInputRef: MutableRefObject<HTMLInputElement | null>
  onFilePicked: (e: React.ChangeEvent<HTMLInputElement>) => void
  headerMenuOpen: boolean
  setHeaderMenuOpen: (v: boolean | ((p: boolean) => boolean)) => void
  openEditProject: () => void
  setShowDeleteProject: (v: boolean) => void
  tabs: TabDef[]
  activeTab: string
  setActiveTab: (id: string) => void
}

export default function ProjectHeader(props: ProjectHeaderProps) {
  const {
    detailIsLoading,
    project,
    projectGradientClass,
    headerBadge,
    ownerNameText,
    stats,
    formatRelativeTime,
    isLocalFavorite,
    handleToggleFavorite,
    canManageMembers,
    setShowInviteMember,
    setInviteSelectedUserId,
    setInviteSearch,
    setInviteError,
    isUploading,
    uploadPercent,
    fileInputRef,
    onFilePicked,
    headerMenuOpen,
    setHeaderMenuOpen,
    openEditProject,
    setShowDeleteProject,
    tabs,
    activeTab,
    setActiveTab,
  } = props

  return (
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
                {typeof project.progressPercentage === 'number' && (
                  <span className="inline-flex items-center gap-1.5 shrink-0 ml-1.5 pl-2 border-l border-border/70">
                    <span className="relative w-24 h-2 rounded-full bg-surface-secondary overflow-hidden shrink-0">
                      <span
                        className={clsx(
                          'absolute inset-y-0 left-0 rounded-full transition-all',
                          project.progressPercentage >= 95
                            ? 'bg-emerald-500'
                            : project.progressPercentage >= 30
                              ? 'bg-amber-500'
                              : 'bg-slate-400'
                        )}
                        style={{ width: `${Math.max(0, Math.min(100, project.progressPercentage))}%` }}
                      />
                    </span>
                    <span className="text-[10.5px] font-semibold text-muted-foreground tabular-nums shrink-0">
                      {project.progressPercentage}%
                    </span>
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
              project?.id && isLocalFavorite('PROJECT', project.id)
                ? 'Quitar proyecto de favoritos'
                : 'Marcar proyecto como favorito'
            }
            title={
              project?.id && isLocalFavorite('PROJECT', project.id)
                ? 'Quitar de favoritos'
                : 'Añadir a favoritos'
            }
            disabled={!project}
            onClick={() => project?.id && handleToggleFavorite('PROJECT', project.id)}
            className={clsx(
              'btn-secondary text-[11.5px] px-2.5 h-8 min-w-[32px] focus-visible:ring-2 focus-visible:ring-brand-500/60',
              project?.id && isLocalFavorite('PROJECT', project.id) &&
                'text-status-review ring-1 ring-status-review/25 bg-status-review/8'
            )}
          >
            <Star
              className={clsx(
                'w-3.5 h-3.5',
                project?.id && isLocalFavorite('PROJECT', project.id) && 'fill-current'
              )}
            />
            <span className="hidden sm:inline">
              {project?.id && isLocalFavorite('PROJECT', project.id) ? 'Favorito' : 'Favoritos'}
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
          {(activeTab === 'docs' || isUploading) && (
            <>
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
            </>
          )}
          {activeTab !== 'docs' && !isUploading && (
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={onFilePicked}
              disabled={!project || isUploading}
              multiple
            />
          )}
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
                      project?.id && handleToggleFavorite('PROJECT', project.id)
                    }}
                    className={clsx(
                      'w-full flex items-center gap-2 px-2 py-1 rounded-md h-8 focus-visible:ring-2 focus-visible:ring-brand-500/60 focus:outline-none',
                      project?.id && isLocalFavorite('PROJECT', project.id)
                        ? 'bg-status-review/8 text-status-review hover:bg-status-review/15'
                        : 'hover:bg-surface-secondary text-foreground'
                    )}
                  >
                    <Star
                      className={clsx(
                        'w-3.5 h-3.5',
                        project?.id && isLocalFavorite('PROJECT', project.id) && 'fill-current'
                      )}
                    />
                    {project?.id && isLocalFavorite('PROJECT', project.id)
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
  )
}
