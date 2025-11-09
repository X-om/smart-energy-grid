import { Router, type IRouter } from 'express';
import { assignMeter, changeUserRole, deleteUser } from '../controllers/admin/adminOpControllers.js';
import { getSystemStats } from '../controllers/admin/adminFetchControllers.js';
import { assignMeterInputValidation, changeRoleInputValidation, deleteUserInputValidation } from '../middleware/admin/inputValidationMiddleware.js';

const router: IRouter = Router();

router.get('/stats', getSystemStats);

router.post('/assign-meter', assignMeterInputValidation, assignMeter);
router.put('/users/:userId/role', changeRoleInputValidation, changeUserRole);
router.delete('/users/:userId', deleteUserInputValidation, deleteUser);

export default router;
