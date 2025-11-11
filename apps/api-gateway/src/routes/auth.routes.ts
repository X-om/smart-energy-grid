import { Router, type IRouter } from 'express';
import { registerController, verifyOTPController, resendOTPController } from '../controllers/auth/register.controller.js';
import { loginController } from '../controllers/auth/login.controller.js';
import { setPasswordController, changePasswordController, forgotPasswordController, resetPasswordController } from '../controllers/auth/password.controller.js';
import { refreshTokenController, logoutController, logoutAllController } from '../controllers/auth/token.controller.js';
import { authenticate } from '../middleware/auth/authenticate.js';
import { validateRequest } from '../utils/validators.js';
import { registerSchema, verifyOTPSchema, loginSchema, setPasswordSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema, refreshTokenSchema, resendOTPSchema } from '../middleware/validation/auth.validation.js';

const router: IRouter = Router();

router.post('/register', validateRequest(registerSchema), registerController);
router.post('/verify-otp', validateRequest(verifyOTPSchema), verifyOTPController);
router.post('/resend-otp', validateRequest(resendOTPSchema), resendOTPController);
router.post('/set-password', validateRequest(setPasswordSchema), setPasswordController);
router.post('/login', validateRequest(loginSchema), loginController);
router.post('/forgot-password', validateRequest(forgotPasswordSchema), forgotPasswordController);
router.post('/reset-password', validateRequest(resetPasswordSchema), resetPasswordController);
router.post('/refresh-token', validateRequest(refreshTokenSchema), refreshTokenController);


// Change password (authenticated users)
router.put('/change-password', authenticate, validateRequest(changePasswordSchema), changePasswordController);
router.post('/logout', authenticate, logoutController);
router.post('/logout-all', authenticate, logoutAllController);

export default router;
