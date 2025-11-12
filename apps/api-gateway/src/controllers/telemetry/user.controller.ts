import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { getUserById } from '../../services/database/user.service';
import { getLatestReading, getMeterHistory, getMeterStats, getDailyBreakdown, getMonthlyBreakdown, comparePeriods } from '../../services/external/timescaleClient';

// * Get current user's latest meter reading
export const getMyLatestReading = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;

    const user = await getUserById(userId);
    if (!user || !user.meter_id)
      throw new NotFoundError('No meter assigned to your account');

    const reading = await getLatestReading(user.meter_id);
    if (!reading)
      throw new NotFoundError('No readings available for your meter');

    successResponse(res, 200, 'Latest reading retrieved successfully', reading);
  }
);

// * Get historical data for current user's meter
export const getMyMeterHistory = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const { start, end, resolution = '15m' } = req.query;

    const user = await getUserById(userId);
    if (!user || !user.meter_id) throw new NotFoundError('No meter assigned to your account');

    const endTime = end ? new Date(end as string) : new Date();
    const startTime = start ? new Date(start as string) : new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

    if (startTime >= endTime) throw new BadRequestError('Start time must be before end time');
    const history = await getMeterHistory(user.meter_id, resolution as '1m' | '15m', startTime, endTime);

    successResponse(res, 200, 'Meter history retrieved successfully', {
      meter_id: user.meter_id, start_time: startTime, end_time: endTime, resolution, data: history
    });
  }
);

// * Get consumption statistics for current user's meter
export const getMyMeterStats = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const { start, end } = req.query;

    const user = await getUserById(userId);
    if (!user || !user.meter_id) throw new NotFoundError('No meter assigned to your account');

    const endTime = end ? new Date(end as string) : new Date();
    const startTime = start ? new Date(start as string) : new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (startTime >= endTime) throw new BadRequestError('Start time must be before end time');
    const stats = await getMeterStats(user.meter_id, startTime, endTime);

    successResponse(res, 200, 'Consumption statistics retrieved successfully', {
      meter_id: user.meter_id, period: { start: startTime, end: endTime }, stats
    });
  }
);

// * Get daily breakdown for current user's meter
export const getMyDailyBreakdown = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const { start_date, end_date } = req.query;

    const user = await getUserById(userId);
    if (!user || !user.meter_id) throw new NotFoundError('No meter assigned to your account');

    const endDate = end_date ? new Date(end_date as string) : new Date();
    const startDate = start_date ? new Date(start_date as string) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (startDate >= endDate) throw new BadRequestError('Start date must be before end date');
    const breakdown = await getDailyBreakdown(user.meter_id, startDate, endDate);

    successResponse(res, 200, 'Daily breakdown retrieved successfully', {
      meter_id: user.meter_id,
      period: { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] },
      breakdown
    });
  }
);

// * Get monthly breakdown for current user's meter
export const getMyMonthlyBreakdown = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const { start_month, end_month } = req.query;

    const user = await getUserById(userId);

    if (!user || !user.meter_id) throw new NotFoundError('No meter assigned to your account');

    const endDate = end_month ? new Date(`${end_month}-01`) : new Date();
    const startDate = start_month ? new Date(`${start_month}-01`) : new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1);

    if (startDate >= endDate) throw new BadRequestError('Start month must be before end month');
    const breakdown = await getMonthlyBreakdown(user.meter_id, startDate, endDate);

    successResponse(res, 200, 'Monthly breakdown retrieved successfully', {
      meter_id: user.meter_id,
      period: {
        start: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`,
        end: `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`,
      },
      breakdown,
    });
  }
);

// * Compare two time periods for current user's meter
export const compareMyPeriods = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;

    const { period1_start, period1_end, period2_start, period2_end } = req.query;
    if (!period1_start || !period1_end || !period2_start || !period2_end) throw new BadRequestError('All period parameters are required');

    const user = await getUserById(userId);
    if (!user || !user.meter_id) throw new NotFoundError('No meter assigned to your account');

    const p1Start = new Date(period1_start as string);
    const p1End = new Date(period1_end as string);
    const p2Start = new Date(period2_start as string);
    const p2End = new Date(period2_end as string);

    if (p1Start >= p1End) throw new BadRequestError('Period 1 start must be before period 1 end');
    if (p2Start >= p2End) throw new BadRequestError('Period 2 start must be before period 2 end');

    const comparison = await comparePeriods(user.meter_id, p1Start, p1End, p2Start, p2End);

    successResponse(res, 200, 'Period comparison retrieved successfully', {
      meter_id: user.meter_id,
      comparison,
    });
  }
);
