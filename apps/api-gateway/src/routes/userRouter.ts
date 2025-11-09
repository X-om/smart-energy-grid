import { Router, type IRouter } from 'express';
import { getUserProfile } from '../controllers/user/userFetchControllers.js';
import { register, verifyOTP } from '../controllers/user/userOpControllers.js';
import { registerInputValidation, verifyOTPInputValidation } from '../middleware/user/inputValidationMiddleware.js';

const router: IRouter = Router();

// Public routes
router.post('/register', registerInputValidation, register);
router.post('/verify-otp', verifyOTPInputValidation, verifyOTP);

// Protected routes (to be added with auth middleware)
router.get('/:userId', getUserProfile);
export default router;
