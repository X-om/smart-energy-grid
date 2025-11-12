import { Router, type IRouter } from 'express';
import { assignMeter, changeUserRole, deleteUser } from '../controllers/admin/adminOpControllers';
import { getSystemStats } from '../controllers/admin/adminFetchControllers';
import {
  assignMeterController,
  unassignMeterController,
  bulkAssignMetersController,
  getMeterStatsController,
} from '../controllers/admin/meter-management.controller';
import { authenticate } from '../middleware/auth/authenticate';
import { isAdmin } from '../middleware/auth/authorize';

const router: IRouter = Router();

// All admin routes require authentication and admin role
router.use(authenticate, isAdmin);

router.get('/stats', getSystemStats);

// Legacy meter assignment (kept for backward compatibility)
router.post('/assign-meter', assignMeter);

// New meter management endpoints
router.post('/meters/assign', assignMeterController);
router.delete('/meters/unassign/:userId', unassignMeterController);
router.post('/meters/bulk-assign', bulkAssignMetersController);
router.get('/meters/stats', getMeterStatsController);

// User management
router.put('/users/:userId/role', changeUserRole);
router.delete('/users/:userId', deleteUser);

export default router;
