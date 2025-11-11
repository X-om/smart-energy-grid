import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { successResponse } from '../../utils/response.js';
import { NotFoundError } from '../../utils/errors.js';
import { getUserById } from '../../services/database/user.service.js';
import { tariffClient } from '../../services/external/tariffClient.js';

// * Get current tariff for the authenticated user's region
export const getCurrentTariffForUser = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const user = await getUserById(userId);

    if (!user || !user.region) throw new NotFoundError('User region not found');
    const tariff = await tariffClient.getCurrentTariff(user.region);

    successResponse(res, 200, 'Current tariff retrieved successfully', { region: user.region, tariff });
  }
);

// * Get current tariff for a specific region
export const getCurrentTariffByRegion = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { region } = req.params;
    const tariff = await tariffClient.getCurrentTariff(region);

    successResponse(res, 200, 'Current tariff retrieved successfully', { region, tariff });
  }
);

// * Get tariff history for the authenticated user's region
export const getTariffHistory = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const { limit } = req.query;

    const user = await getUserById(userId);
    if (!user || !user.region) throw new NotFoundError('User region not found');

    const history = await tariffClient.getTariffHistory(user.region, limit ? parseInt(limit as string) : undefined);
    successResponse(res, 200, 'Tariff history retrieved successfully', { region: user.region, history: history.data, pagination: history.pagination });
  }
);

// * Estimate cost for a given consumption amount
export const estimateCost = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const { consumption_kwh, region: queryRegion } = req.query;

    const user = await getUserById(userId);
    if (!user || !user.region) throw new NotFoundError('User region not found');

    const targetRegion = (queryRegion as string) || user.region;
    const consumptionKwh = parseFloat(consumption_kwh as string);
    const tariff = await tariffClient.getCurrentTariff(targetRegion);
    const estimatedCost = consumptionKwh * tariff.price;

    successResponse(res, 200, 'Cost estimated successfully', {
      region: targetRegion, consumption_kwh: consumptionKwh,
      current_price_per_kwh: tariff.price, estimated_cost: parseFloat(estimatedCost.toFixed(2)),
      tariff_details: { effective_from: tariff.effective_from, tier: tariff.tier, load_percentage: tariff.load_percentage }
    });
  }
);

// * Forecast future tariff (placeholder for ML integration)
export const forecastTariff = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const { hours = 24 } = req.query;

    const user = await getUserById(userId);
    if (!user || !user.region) throw new NotFoundError('User region not found');

    const currentTariff = await tariffClient.getCurrentTariff(user.region);

    // TODO: Implement ML-based forecasting
    // For now, return placeholder data based on current tariff
    const forecastHours = parseInt(hours as string);
    const forecasts = [];

    for (let i = 1; i <= Math.min(forecastHours, 48); i++) {
      const forecastTime = new Date(Date.now() + i * 60 * 60 * 1000);

      // * Placeholder: slight variation around current price
      // * In production, this would use historical patterns and ML predictions
      const variation = (Math.random() - 0.5) * 0.5;
      const forecastedPrice = currentTariff.price * (1 + variation);

      forecasts.push({ timestamp: forecastTime.toISOString(), predicted_price: parseFloat(forecastedPrice.toFixed(2)), confidence: 'low' });
    }

    successResponse(res, 200, 'Tariff forecast generated (placeholder data)', {
      region: user.region, current_price: currentTariff.price,
      forecast_hours: forecastHours, forecasts,
      note: 'This is placeholder data. ML-based forecasting will be implemented in a future version.'
    });
  }
);
