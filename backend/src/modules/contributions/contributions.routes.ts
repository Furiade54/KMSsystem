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

function eitherOr(
  primary: (req: Request, _res: any, next: any) => void,
  fallback: (req: Request, _res: any, next: any) => void,
) {
  return (req: Request, _res: any, next: any) => {
    try {
      primary(req, _res, (err?: any) => {
        if (!err) return next()
        fallback(req, _res, next)
      })
    } catch (e) {
      fallback(req, _res, next)
    }
  }
}

contributionsRouter.get(
  '/',
  eitherOr(requirePermission('aportes.ver'), requireResourcePermission('PROJECT', 'VER', projectIdFromParams)),
  listProjectContributionsEndpoint,
)
contributionsRouter.get(
  '/:contributionId',
  eitherOr(requirePermission('aportes.ver'), requireResourcePermission('PROJECT', 'VER', projectIdFromParams)),
  getContributionEndpoint,
)
contributionsRouter.post(
  '/',
  eitherOr(requirePermission('aportes.crear'), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)),
  createContributionEndpoint,
)
contributionsRouter.patch(
  '/:contributionId',
  eitherOr(requirePermission('aportes.editar'), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)),
  updateContributionEndpoint,
)
contributionsRouter.delete(
  '/:contributionId',
  eitherOr(requirePermission('aportes.eliminar'), requireResourcePermission('PROJECT', 'ADMINISTRAR', projectIdFromParams)),
  deleteContributionEndpoint,
)

contributionsRouter.get(
  '/:contributionId/temas',
  eitherOr(requirePermission('aportes.ver'), requireResourcePermission('PROJECT', 'VER', projectIdFromParams)),
  listLinkedTopicsEndpoint,
)
contributionsRouter.post(
  '/:contributionId/temas',
  eitherOr(requirePermission('aportes.editar'), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)),
  linkTopicEndpoint,
)
contributionsRouter.delete(
  '/:contributionId/temas/:topicId',
  eitherOr(requirePermission('aportes.editar'), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)),
  unlinkTopicEndpoint,
)

contributionsRouter.post(
  '/:contributionId/compartir',
  eitherOr(requirePermission('aportes.compartir'), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)),
  (_req: Request, res: any) => {
    res.status(501).json({
      success: false,
      message: 'Compartir aportes con ACL individual vendrá en la siguiente iteración (Usa compartidos genéricos por ahora).',
      code: 'NOT_IMPLEMENTED',
    })
  },
)

export default contributionsRouter
