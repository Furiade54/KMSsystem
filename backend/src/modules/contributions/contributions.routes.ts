import { Router, type Request } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission, requireResourcePermission } from '../../shared/middleware/rbac'
import {
  createContributionEndpoint,
  deleteContributionEndpoint,
  getContributionEndpoint,
  linkTopicEndpoint,
  listLinkedTopicsEndpoint,
  listProjectContributionsEndpoint,
  unlinkTopicEndpoint,
  updateContributionEndpoint,
} from './contributions.controller'

const contributionsRouter = Router({ mergeParams: true })

contributionsRouter.use(requireAuth)

const projectIdFromParams = (req: Request) => String((req.params as any).projectId || '')

contributionsRouter.get(
  '/',
  requireResourcePermission('PROJECT', 'VER', projectIdFromParams),
  requirePermission('aportes.ver'),
  listProjectContributionsEndpoint,
)
contributionsRouter.get(
  '/:contributionId',
  requireResourcePermission('PROJECT', 'VER', projectIdFromParams),
  requirePermission('aportes.ver'),
  getContributionEndpoint,
)
contributionsRouter.post(
  '/',
  requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams),
  requirePermission('aportes.crear'),
  createContributionEndpoint,
)
contributionsRouter.patch(
  '/:contributionId',
  requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams),
  requirePermission('aportes.editar'),
  updateContributionEndpoint,
)
contributionsRouter.delete(
  '/:contributionId',
  requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams),
  requirePermission('aportes.eliminar'),
  deleteContributionEndpoint,
)

contributionsRouter.get(
  '/:contributionId/temas',
  requireResourcePermission('PROJECT', 'VER', projectIdFromParams),
  requirePermission('aportes.ver'),
  listLinkedTopicsEndpoint,
)
contributionsRouter.post(
  '/:contributionId/temas',
  requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams),
  requirePermission('aportes.editar'),
  linkTopicEndpoint,
)
contributionsRouter.delete(
  '/:contributionId/temas/:topicId',
  requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams),
  requirePermission('aportes.editar'),
  unlinkTopicEndpoint,
)

contributionsRouter.post(
  '/:contributionId/compartir',
  requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams),
  requirePermission('aportes.compartir'),
  (_req: Request, res: any) => {
    res.status(501).json({
      success: false,
      message: 'Compartir aportes con ACL individual vendrá en la siguiente iteración (Usa compartidos genéricos por ahora).',
      code: 'NOT_IMPLEMENTED',
    })
  },
)

export default contributionsRouter
