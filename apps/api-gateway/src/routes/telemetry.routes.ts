import { Router, type IRouter } from 'express';
import { authenticate } from '../middleware/auth/authenticate';
import { authorize } from '../middleware/auth/authorize';
import { validateQuery, validateParams } from '../utils/validators';
import { getMyLatestReading, getMyMeterHistory, getMyMeterStats, getMyDailyBreakdown, getMyMonthlyBreakdown, compareMyPeriods } from '../controllers/telemetry/user.controller';
import { getMeterReading, getMeterHistoryController, getRegionalStatsController, getTopConsumersController, getRealtimeLoadController } from '../controllers/telemetry/operator.controller';
import { timeRangeSchema, dailyQuerySchema, monthlyQuerySchema, comparePeriodSchema, topConsumersSchema, meterIdParamSchema, regionParamSchema } from '../middleware/validation/telemetry.validation';

const router: IRouter = Router();

// * User routes - my meter data
router.get('/my-meter', authenticate, getMyLatestReading);
router.get('/my-meter/history', authenticate, validateQuery(timeRangeSchema), getMyMeterHistory);
router.get('/my-meter/stats', authenticate, validateQuery(timeRangeSchema), getMyMeterStats);
router.get('/my-meter/daily', authenticate, validateQuery(dailyQuerySchema), getMyDailyBreakdown);
router.get('/my-meter/monthly', authenticate, validateQuery(monthlyQuerySchema), getMyMonthlyBreakdown);
router.get('/my-meter/compare', authenticate, validateQuery(comparePeriodSchema), compareMyPeriods);

// * Operator/Admin routes - specific meter data
router.get('/meters/:meterId', authenticate, authorize('operator', 'admin'), validateParams(meterIdParamSchema), getMeterReading);
router.get('/meters/:meterId/history', authenticate, authorize('operator', 'admin'), validateParams(meterIdParamSchema), validateQuery(timeRangeSchema), getMeterHistoryController);

// * Operator/Admin routes - regional data
router.get('/region/:region/stats', authenticate, authorize('operator', 'admin'), validateParams(regionParamSchema), validateQuery(timeRangeSchema), getRegionalStatsController);
router.get('/region/:region/top-consumers', authenticate, authorize('operator', 'admin'), validateParams(regionParamSchema), validateQuery(topConsumersSchema), getTopConsumersController);
router.get('/region/:region/realtime', authenticate, authorize('operator', 'admin'), validateParams(regionParamSchema), getRealtimeLoadController);

export default router;
