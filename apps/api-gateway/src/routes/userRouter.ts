import { Router, type IRouter } from 'express';
import { authenticate } from '../middleware/auth/authenticate';
import { validateRequest } from '../utils/validators';
import { getProfileController, updateProfileController } from '../controllers/user/profile.controller';
import { getPreferencesController, updatePreferencesController } from '../controllers/user/preferences.controller';
import { updateProfileSchema, updatePreferencesSchema } from '../middleware/validation/user.validation';

const router: IRouter = Router();

// * Profile routes
router.get('/profile', authenticate, getProfileController);
router.put('/profile', authenticate, validateRequest(updateProfileSchema), updateProfileController);

// * Notification settings routes
router.get('/notifications/settings', authenticate, getPreferencesController);
router.put('/notifications/settings', authenticate, validateRequest(updatePreferencesSchema), updatePreferencesController);

export default router;
