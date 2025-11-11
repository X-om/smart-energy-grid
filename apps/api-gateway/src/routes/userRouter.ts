import { Router, type IRouter } from 'express';
import { authenticate } from '../middleware/auth/authenticate.js';
import { validateRequest } from '../utils/validators.js';
import { getProfileController, updateProfileController } from '../controllers/user/profile.controller.js';
import { getPreferencesController, updatePreferencesController } from '../controllers/user/preferences.controller.js';
import { updateProfileSchema, updatePreferencesSchema } from '../middleware/validation/user.validation.js';

const router: IRouter = Router();

// * Profile routes
router.get('/profile', authenticate, getProfileController);
router.put('/profile', authenticate, validateRequest(updateProfileSchema), updateProfileController);

// * Notification settings routes
router.get('/notifications/settings', authenticate, getPreferencesController);
router.put('/notifications/settings', authenticate, validateRequest(updatePreferencesSchema), updatePreferencesController);

export default router;
