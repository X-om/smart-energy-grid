import { Router, type IRouter } from 'express';
import { getUserProfile } from '../controllers/user/userFetchControllers.js';
import { registerController, verifyOTPController } from '../controllers/user/userOpControllers.js';
import { registerInputValidation, verifyOTPInputValidation } from '../middleware/user/inputValidationMiddleware.js';

const router: IRouter = Router();

router.post('/register', registerInputValidation, registerController);
router.post('/verify-otp', verifyOTPInputValidation, verifyOTPController);

// Protected routes (to be added with auth middleware)
router.get('/:userId', getUserProfile);
export default router;
