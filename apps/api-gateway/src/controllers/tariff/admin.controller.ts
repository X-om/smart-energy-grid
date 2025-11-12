import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';
import { BadRequestError } from '../../utils/errors';
import { tariffClient } from '../../services/external/tariffClient';
import { logger } from '../../utils/logger';

// * Create a manual tariff override
export const createTariffOverride = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { region, newPrice, reason } = req.body;
    const operatorId = req.user!.userId;
    const operatorEmail = req.user!.email;

    if (newPrice < 0 || newPrice > 100) throw new BadRequestError('Price must be between ₹0 and ₹100 per kWh');

    logger.info('Tariff override requested', { operator_id: operatorId, operator_email: operatorEmail, region, new_price: newPrice, reason, timestamp: new Date().toISOString() });
    const result = await tariffClient.overrideTariff({ region, newPrice, reason, operatorId });

    logger.info('Tariff override created successfully', { operator_id: operatorId, tariff_id: result.data.id, region, new_price: newPrice });
    successResponse(res, 201, result.message || 'Tariff override created successfully', {
      override: result.data, audit: { operator_id: operatorId, operator_email: operatorEmail, timestamp: new Date().toISOString() }
    });
  }
);

// * Remove a tariff override (revert to automatic pricing)
export const removeTariffOverride = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { tariffId } = req.params;

    const operatorId = req.user!.userId;
    const operatorEmail = req.user!.email;

    logger.info('Tariff override removal requested', { operator_id: operatorId, operator_email: operatorEmail, tariff_id: tariffId, timestamp: new Date().toISOString() });
    const result = await tariffClient.removeOverride(tariffId);

    logger.info('Tariff override removed successfully', { operator_id: operatorId, tariff_id: tariffId });
    successResponse(res, 200, result.message || 'Tariff override removed successfully', {
      tariff_id: tariffId, reverted_to_automatic: true,
      audit: { operator_id: operatorId, operator_email: operatorEmail, timestamp: new Date().toISOString() }
    });
  }
);
