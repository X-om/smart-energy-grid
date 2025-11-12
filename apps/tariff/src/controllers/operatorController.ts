import { Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import type { OverrideHandlerService } from '../services/overrideHandlerService';
import type { TariffCalculatorService } from '../services/tariffCalculatorService';

const logger = createLogger('operator-controller');

export const createOperatorController = (overrideHandler: OverrideHandlerService, calculator: TariffCalculatorService) => {

  const tariffOverrideController = async (req: Request, res: Response): Promise<void> => {
    try {
      const { region, newPrice, reason, operatorId } = req.body;

      if (!region || newPrice === undefined)
        return void res.status(400).json({
          status: 'error', message: 'Missing required fields: region, newPrice'
        });

      const result = await overrideHandler.handleOverride({ region, newPrice, reason, operatorId: operatorId || 'MANUAL' });

      if (result.success)
        return void res.status(200).json({
          status: 'success', message: result.message,
          data: {
            tariffId: result.tariffId, region: result.region,
            newPrice: result.newPrice, oldPrice: result.oldPrice
          }
        });

      return void res.status(400).json({ status: 'error', message: result.message });
    } catch (error) {
      logger.error({ error }, 'Error in override endpoint');
      return void res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  };

  const getCurrentTariffController = async (req: Request, res: Response): Promise<void> => {
    try {
      const { region } = req.params;
      const price = await overrideHandler.getCurrentTariff(region);

      if (price === null)
        return void res.status(404).json({
          status: 'error', message: `No tariff found for region: ${region}`
        });

      res.status(200).json({ status: 'success', data: { region, pricePerKwh: price } });
    } catch (error) {
      logger.error({ error }, 'Error getting tariff');
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  };

  const getTariffHistoryController = async (req: Request, res: Response): Promise<void> => {
    try {
      const { region } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      const history = await overrideHandler.getTariffHistory(region, limit);

      return void res.status(200).json({ status: 'success', data: { region, history } });
    } catch (error) {
      logger.error({ error }, 'Error getting tariff history');
      return void res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  };

  const getAllTariffsController = async (_req: Request, res: Response): Promise<void> => {
    try {
      const prices = calculator.getAllPrices();
      const tariffs = Array.from(prices.entries()).map(([region, price]) => ({ region, pricePerKwh: price }));

      return void res.status(200).json({ status: 'success', data: { count: tariffs.length, tariffs } });
    } catch (error) {
      logger.error({ error }, 'Error getting all tariffs');
      return void res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  };

  const removeTariffOverrideController = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tariffId } = req.params;

      if (!tariffId)
        return void res.status(400).json({
          status: 'error', message: 'Tariff ID is required'
        });

      const result = await overrideHandler.removeOverride(tariffId);

      if (result.success)
        return void res.status(200).json({
          status: 'success', message: result.message,
          data: {
            tariffId: result.tariffId,
            region: result.region,
            oldPrice: result.oldPrice,
            newPrice: result.newPrice,
            revertedToAutomatic: true
          }
        });

      // Tariff not found
      if (result.message.includes('not found'))
        return void res.status(404).json({ status: 'error', message: result.message });

      return void res.status(500).json({ status: 'error', message: result.message });
    } catch (error) {
      logger.error({ error }, 'Error removing tariff override');
      return void res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  };

  return {
    tariffOverrideController,
    getCurrentTariffController,
    getTariffHistoryController,
    getAllTariffsController,
    removeTariffOverrideController
  };
};
