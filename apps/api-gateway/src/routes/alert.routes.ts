import { Router, type IRouter } from 'express';
import { authenticate } from '../middleware/auth/authenticate';
import { authorize } from '../middleware/auth/authorize';
import { validateQuery, validateParams, validateRequest } from '../utils/validators';
import { getUserAlerts, getUserAlertById } from '../controllers/alert/user.controller';
import { getAllAlerts, getActiveAlerts, getAlertHistory, getAlertById, acknowledgeAlert, resolveAlert, bulkResolveAlerts, getAlertStats, autoResolveOldAlerts } from '../controllers/alert/operator.controller';
import { alertIdParamSchema, userAlertQuerySchema, operatorAlertQuerySchema, acknowledgeAlertBodySchema, resolveAlertBodySchema, bulkResolveBodySchema, alertStatsQuerySchema, alertHistoryQuerySchema } from '../middleware/validation/alert.validation';

const router: IRouter = Router();

// * User routes - get alerts for authenticated user's meter
router.get('/', authenticate, validateQuery(userAlertQuerySchema), getUserAlerts);
router.get('/:alertId', authenticate, validateParams(alertIdParamSchema), getUserAlertById);

// * Operator routes - alert management
router.get('/operator/all', authenticate, authorize('operator', 'admin'), validateQuery(operatorAlertQuerySchema), getAllAlerts);
router.get('/operator/active', authenticate, authorize('operator', 'admin'), validateQuery(operatorAlertQuerySchema), getActiveAlerts);
router.get('/operator/history/:region', authenticate, authorize('operator', 'admin'), validateQuery(alertHistoryQuerySchema), getAlertHistory);
router.get('/operator/stats', authenticate, authorize('operator', 'admin'), validateQuery(alertStatsQuerySchema), getAlertStats);
router.get('/operator/:alertId', authenticate, authorize('operator', 'admin'), validateParams(alertIdParamSchema), getAlertById);

router.post('/operator/:alertId/acknowledge', authenticate, authorize('operator', 'admin'), validateParams(alertIdParamSchema), validateRequest(acknowledgeAlertBodySchema), acknowledgeAlert);
router.post('/operator/:alertId/resolve', authenticate, authorize('operator', 'admin'), validateParams(alertIdParamSchema), validateRequest(resolveAlertBodySchema), resolveAlert);
router.post('/operator/bulk-resolve', authenticate, authorize('operator', 'admin'), validateRequest(bulkResolveBodySchema), bulkResolveAlerts);

router.post('/operator/auto-resolve', authenticate, authorize('admin'), autoResolveOldAlerts);

export default router;
