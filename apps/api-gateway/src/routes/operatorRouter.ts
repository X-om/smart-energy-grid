import { Router, type IRouter } from 'express';
import { operatorOperation } from '../controllers/operator/operatorOpControllers';
import { getAllUsers, getUsersByRegion } from '../controllers/operator/operatorFetchControllers';
import { authenticate } from '../middleware/auth/authenticate';
import { isOperatorOrAdmin } from '../middleware/auth/authorize';

const router: IRouter = Router();

// All operator routes require authentication and operator/admin role
router.use(authenticate, isOperatorOrAdmin);

// TODO: Add validation middleware for operator routes
router.get('/users', getAllUsers);
router.get('/users/region/:region', getUsersByRegion);
router.post('/operation', operatorOperation);

export default router;
