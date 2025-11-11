import { Router, type IRouter } from 'express';
import { authenticate } from '../middleware/auth/authenticate.js';
import { authorize } from '../middleware/auth/authorize.js';
import { validateRequest } from '../utils/validators.js';
import { getMyLatestReading, getMyMeterHistory, getMyMeterStats, getMyDailyBreakdown, getMyMonthlyBreakdown, compareMyPeriods } from '../controllers/telemetry/user.controller.js';
import { getMeterReading, getMeterHistoryController, getRegionalStatsController, getTopConsumersController, getRealtimeLoadController } from '../controllers/telemetry/operator.controller.js';
import { timeRangeSchema, dailyQuerySchema, monthlyQuerySchema, comparePeriodSchema, topConsumersSchema, meterIdParamSchema, regionParamSchema } from '../middleware/validation/telemetry.validation.js';

const router: IRouter = Router();

// * User routes - my meter data
router.get('/my-meter', authenticate, getMyLatestReading);
router.get('/my-meter/history', authenticate, validateRequest(timeRangeSchema), getMyMeterHistory);
router.get('/my-meter/stats', authenticate, validateRequest(timeRangeSchema), getMyMeterStats);
router.get('/my-meter/daily', authenticate, validateRequest(dailyQuerySchema), getMyDailyBreakdown);
router.get('/my-meter/monthly', authenticate, validateRequest(monthlyQuerySchema), getMyMonthlyBreakdown);
router.get('/my-meter/compare', authenticate, validateRequest(comparePeriodSchema), compareMyPeriods);

// * Operator/Admin routes - specific meter data
router.get('/meters/:meterId', authenticate, authorize('operator', 'admin'), validateRequest(meterIdParamSchema), getMeterReading);
router.get('/meters/:meterId/history', authenticate, authorize('operator', 'admin'), validateRequest(meterIdParamSchema), validateRequest(timeRangeSchema), getMeterHistoryController);

// * Operator/Admin routes - regional data
router.get('/region/:region/stats', authenticate, authorize('operator', 'admin'), validateRequest(regionParamSchema), validateRequest(timeRangeSchema), getRegionalStatsController);
router.get('/region/:region/top-consumers', authenticate, authorize('operator', 'admin'), validateRequest(regionParamSchema), validateRequest(topConsumersSchema), getTopConsumersController);
router.get('/region/:region/realtime', authenticate, authorize('operator', 'admin'), validateRequest(regionParamSchema), getRealtimeLoadController);

export default router;
