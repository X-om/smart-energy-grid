import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';
import {
  assignMeterToUser,
  unassignMeterFromUser,
  bulkAssignMeters,
  getMeterAssignmentStats,
} from '../../services/database/meter-assignment.service';

// * POST /api/v1/admin/meters/assign
export const assignMeterController = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { userId, meterId, region } = req.body;
    const result = await assignMeterToUser(userId, meterId, region);

    successResponse(res, 200, 'Meter assigned successfully', {
      user_id: result.user_id,
      meter_id: result.meter_id,
      region: result.region,
    });
  }
);

// * DELETE /api/v1/admin/meters/unassign/:userId
export const unassignMeterController = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { userId } = req.params;
    await unassignMeterFromUser(userId);

    successResponse(res, 200, 'Meter unassigned successfully', { user_id: userId });
  }
);

// * POST /api/v1/admin/meters/bulk-assign
export const bulkAssignMetersController = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const result = await bulkAssignMeters();

    successResponse(res, 200, 'Bulk meter assignment completed', {
      summary: {
        success: result.success,
        failed: result.failed,
        total: result.success + result.failed,
      },
      successful_assignments: result.results.filter(r => !r.error).map(r => ({
        user_id: r.userId,
        email: r.email,
        meter_id: r.meterId,
        region: r.region,
      })),
      failed_assignments: result.results.filter(r => r.error).map(r => ({
        user_id: r.userId,
        email: r.email,
        error: r.error,
      })),
    });
  }
);

// * GET /api/v1/admin/meters/stats
export const getMeterStatsController = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const stats = await getMeterAssignmentStats();

    successResponse(res, 200, 'Meter assignment statistics retrieved successfully', { stats });
  }
);
