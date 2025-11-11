import { Router, type IRouter } from 'express';
import { operatorOperation } from '../controllers/operator/operatorOpControllers.js';
import { getAllUsers, getUsersByRegion } from '../controllers/operator/operatorFetchControllers.js';
import { authenticate } from '../middleware/auth/authenticate.js';
import { isOperatorOrAdmin } from '../middleware/auth/authorize.js';

const router: IRouter = Router();

// All operator routes require authentication and operator/admin role
router.use(authenticate, isOperatorOrAdmin);

// TODO: Add validation middleware for operator routes
router.get('/users', getAllUsers);
router.get('/users/region/:region', getUsersByRegion);
router.post('/operation', operatorOperation);

export default router;
