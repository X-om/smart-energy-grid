import { Router, type IRouter } from 'express';
import { assignMeter, changeUserRole, deleteUser } from '../controllers/admin/adminOpControllers.js';
import { getSystemStats } from '../controllers/admin/adminFetchControllers.js';
import { authenticate } from '../middleware/auth/authenticate.js';
import { isAdmin } from '../middleware/auth/authorize.js';

const router: IRouter = Router();

// All admin routes require authentication and admin role
router.use(authenticate, isAdmin);

router.get('/stats', getSystemStats);

// TODO: Add validation middleware for admin routes
router.post('/assign-meter', assignMeter);
router.put('/users/:userId/role', changeUserRole);
router.delete('/users/:userId', deleteUser);

export default router;
