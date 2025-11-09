import { Router, type IRouter } from 'express';
import { operatorOperation } from '../controllers/operator/operatorOpControllers.js';
import { getAllUsers, getUsersByRegion } from '../controllers/operator/operatorFetchControllers.js';
import { getAllUsersInputValidation, getUsersByRegionInputValidation } from '../middleware/operator/inputValidationMiddleware.js';

const router: IRouter = Router();

router.get('/users', getAllUsersInputValidation, getAllUsers);
router.get('/users/region/:region', getUsersByRegionInputValidation, getUsersByRegion);

router.post('/operation', operatorOperation);

export default router;
