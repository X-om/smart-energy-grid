import { Router, type IRouter } from 'express';
import { authenticate } from '../middleware/auth/authenticate';
import { authorize } from '../middleware/auth/authorize';
import { validateQuery, validateParams, validateRequest } from '../utils/validators';
import { getCurrentTariffForUser, getCurrentTariffByRegion, getTariffHistory, estimateCost, forecastTariff } from '../controllers/tariff/user.controller';
import { getAllRegionalTariffs, getTariffAnalytics } from '../controllers/tariff/operator.controller';
import { createTariffOverride, removeTariffOverride } from '../controllers/tariff/admin.controller';
import { regionParamSchema, tariffHistoryQuerySchema, estimateQuerySchema, analyticsQuerySchema, overrideBodySchema, tariffIdParamSchema } from '../middleware/validation/tariff.validation';

const router: IRouter = Router();

// * User routes - tariff information
router.get('/current', authenticate, getCurrentTariffForUser);
router.get('/current/:region', authenticate, validateParams(regionParamSchema), getCurrentTariffByRegion);
router.get('/history', authenticate, validateQuery(tariffHistoryQuerySchema), getTariffHistory);
router.get('/estimate', authenticate, validateQuery(estimateQuerySchema), estimateCost);
router.get('/forecast', authenticate, forecastTariff);

// * Operator routes - regional tariff management
router.get('/regions/all', authenticate, authorize('operator', 'admin'), getAllRegionalTariffs);
router.get('/analytics', authenticate, authorize('operator', 'admin'), validateQuery(analyticsQuerySchema), getTariffAnalytics);

// * Admin routes - tariff overrides
router.post('/override', authenticate, authorize('admin'), validateRequest(overrideBodySchema), createTariffOverride);
router.delete('/override/:tariffId', authenticate, authorize('admin'), validateParams(tariffIdParamSchema), removeTariffOverride);

export default router;
