import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import { getUserById } from '../../services/database/user.service';
import { alertClient } from '../../services/external/alertClient';

// * Get alerts for the authenticated user's meter
export const getUserAlerts = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const user = await getUserById(userId);

    if (!user || !user.meter_id) {
      throw new NotFoundError('User meter ID not found');
    }

    // Extract query parameters
    const { status, severity, type, limit, offset } = req.query;

    // Call alert service with user's meter_id
    const response = await alertClient.getUserAlerts({
      meter_id: user.meter_id,
      status: status as string | undefined,
      severity: severity as string | undefined,
      type: type as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    successResponse(res, 200, 'User alerts retrieved successfully', {
      alerts: response.data.alerts,
      pagination: response.data.pagination,
      summary: response.data.summary,
    });
  }
);

// * Get a specific alert by ID for the authenticated user
export const getUserAlertById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const { alertId } = req.params;

    const user = await getUserById(userId);
    if (!user || !user.meter_id) {
      throw new NotFoundError('User meter ID not found');
    }

    // Fetch alert from alert service with meter_id for access control
    const response = await alertClient.getUserAlertById(alertId, user.meter_id);

    // Additional check: ensure the alert belongs to this user's meter
    if (response.data.alert.meter_id !== user.meter_id) {
      throw new ForbiddenError('You do not have access to this alert');
    }

    successResponse(res, 200, 'Alert retrieved successfully', response.data.alert);
  }
);
