import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';
import { BadRequestError } from '../../utils/errors';
import { getLatestReading, getMeterHistory, getRegionalStats, getTopConsumers, getRealtimeRegionalLoad } from '../../services/external/timescaleClient';

// * Get specific meter reading (operator/admin)
export const getMeterReading = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { meterId } = req.params;
    const reading = await getLatestReading(meterId);

    successResponse(res, 200, 'Meter reading retrieved successfully', reading);
  }
);

// * Get meter history (operator/admin)
export const getMeterHistoryController = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { meterId } = req.params;
    const { start, end, resolution = '15m' } = req.query;

    const endTime = end ? new Date(end as string) : new Date();
    const startTime = start ? new Date(start as string) : new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

    if (startTime >= endTime) throw new BadRequestError('Start time must be before end time');
    const history = await getMeterHistory(meterId, resolution as '1m' | '15m', startTime, endTime);

    successResponse(res, 200, 'Meter history retrieved successfully', {
      meter_id: meterId, start_time: startTime, end_time: endTime, resolution, data: history
    });
  }
);

// * Get regional statistics (operator/admin)
export const getRegionalStatsController = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { region } = req.params;
    const { start, end } = req.query;

    const endTime = end ? new Date(end as string) : new Date();
    const startTime = start ? new Date(start as string) : new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (startTime >= endTime) throw new BadRequestError('Start time must be before end time');
    const stats = await getRegionalStats(region, startTime, endTime);

    successResponse(res, 200, 'Regional statistics retrieved successfully', {
      period: { start: startTime, end: endTime }, stats
    });
  }
);

// * Get top consumers in a region (operator/admin)
export const getTopConsumersController = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { region } = req.params;
    const { start, end, limit = '10' } = req.query;

    const endTime = end ? new Date(end as string) : new Date();
    const startTime = start ? new Date(start as string) : new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (startTime >= endTime) throw new BadRequestError('Start time must be before end time');
    const limitNum = parseInt(limit as string, 10);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) throw new BadRequestError('Limit must be between 1 and 100');
    const consumers = await getTopConsumers(region, startTime, endTime, limitNum);

    successResponse(res, 200, 'Top consumers retrieved successfully', {
      region, period: {
        start: startTime, end: endTime,
      }, limit: limitNum, consumers
    });
  }
);

// * Get real-time regional load (operator/admin)
export const getRealtimeLoadController = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { region } = req.params;
    const load = await getRealtimeRegionalLoad(region);

    successResponse(res, 200, 'Real-time load retrieved successfully', load);
  }
);
