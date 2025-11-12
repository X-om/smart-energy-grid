import { Router, type IRouter } from 'express';
import { registerController, verifyOTPController, resendOTPController } from '../controllers/auth/register.controller';
import { loginController } from '../controllers/auth/login.controller';
import { setPasswordController, changePasswordController, forgotPasswordController, resetPasswordController } from '../controllers/auth/password.controller';
import { refreshTokenController, logoutController, logoutAllController } from '../controllers/auth/token.controller';
import { authenticate } from '../middleware/auth/authenticate';
import { validateRequest } from '../utils/validators';
import { registerSchema, verifyOTPSchema, loginSchema, setPasswordSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema, refreshTokenSchema, resendOTPSchema } from '../middleware/validation/auth.validation';

const router: IRouter = Router();

router.post('/register', validateRequest(registerSchema), registerController);
router.post('/verify-email', validateRequest(verifyOTPSchema), verifyOTPController);
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
