import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { successResponse } from '../../utils/response.js';
import { getUserPreferences, updateUserPreferences, createDefaultPreferences } from '../../services/database/preferences.service.js';

// * GET /api/v1/user/notifications/settings
export const getPreferencesController = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    let preferences = await getUserPreferences(userId);

    if (!preferences)
      preferences = await createDefaultPreferences(userId);

    successResponse(res, 200, 'Preferences retrieved successfully', preferences);
  }
);

// * PUT /api/v1/user/notifications/settings
export const updatePreferencesController = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const updatedPreferences = await updateUserPreferences(userId, req.body);

    successResponse(res, 200, 'Preferences updated successfully', updatedPreferences);
  }
);
