/**
 * Operator API Routes
 * 
 * Express routes for manual tariff override and queries
 */

import express, { Request, Response, Router } from 'express';
import { createLogger } from '../utils/logger.js';
import type { OverrideHandlerService } from '../services/overrideHandler.js';
import type { TariffCalculatorService } from '../services/tariffCalculator.js';

const logger = createLogger('operator-api');

export function createOperatorRouter(
  overrideHandler: OverrideHandlerService,
  calculator: TariffCalculatorService
): Router {
  const router = express.Router();

  /**
   * POST /operator/tariff/override
   * Manual tariff override
   */
  router.post('/tariff/override', async (req: Request, res: Response) => {
    try {
      const { region, newPrice, reason, operatorId } = req.body;

      // Validate request body
      if (!region || newPrice === undefined) {
        res.status(400).json({
          status: 'error',
          message: 'Missing required fields: region, newPrice',
        });
        return;
      }

      // Process override
      const result = await overrideHandler.handleOverride({
        region,
        newPrice,
        reason,
        operatorId: operatorId || 'MANUAL',
      });

      if (result.success) {
        res.status(200).json({
          status: 'success',
          message: result.message,
          data: {
            tariffId: result.tariffId,
            region: result.region,
            newPrice: result.newPrice,
            oldPrice: result.oldPrice,
          },
        });
      } else {
        res.status(400).json({
          status: 'error',
          message: result.message,
        });
      }
    } catch (error) {
      logger.error({ error }, 'Error in override endpoint');
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
      });
    }
  });

  /**
   * GET /operator/tariff/:region
   * Get current tariff for a region
   */
  router.get('/tariff/:region', async (req: Request, res: Response) => {
    try {
      const { region } = req.params;

      const price = await overrideHandler.getCurrentTariff(region);

      if (price === null) {
        res.status(404).json({
          status: 'error',
          message: `No tariff found for region: ${region}`,
        });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: {
          region,
          pricePerKwh: price,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error getting tariff');
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
      });
    }
  });

  /**
   * GET /operator/tariff/:region/history
   * Get tariff history for a region
   */
  router.get('/tariff/:region/history', async (req: Request, res: Response) => {
    try {
      const { region } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      const history = await overrideHandler.getTariffHistory(region, limit);

      res.status(200).json({
        status: 'success',
        data: {
          region,
          history,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error getting tariff history');
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
      });
    }
  });

  /**
   * GET /operator/tariffs/all
   * Get all current tariffs
   */
  router.get('/tariffs/all', async (_req: Request, res: Response) => {
    try {
      const prices = calculator.getAllPrices();
      const tariffs = Array.from(prices.entries()).map(([region, price]) => ({
        region,
        pricePerKwh: price,
      }));

      res.status(200).json({
        status: 'success',
        data: {
          count: tariffs.length,
          tariffs,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error getting all tariffs');
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
      });
    }
  });

  /**
   * GET /operator/health
   * Health check endpoint
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'tariff',
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
