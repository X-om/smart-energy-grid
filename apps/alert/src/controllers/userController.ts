import { Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import type { AlertManagerService } from '../services/alertManagerService';

const logger = createLogger('user-controller');

export const createUserController = (alertManager: AlertManagerService) => {

  const getUserAlertsController = async (req: Request, res: Response): Promise<void> => {
    try {
      const meterId = req.query.meter_id as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string | undefined;
      const severity = req.query.severity as string | undefined;
      const type = req.query.type as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      if (!meterId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Missing required query parameter: meter_id'
        });
      }

      const filters: any = { meter_id: meterId };
      if (status) filters.status = status;
      if (severity) filters.severity = severity;
      if (type) filters.type = type;
      if (startDate) filters.start_date = new Date(startDate);
      if (endDate) filters.end_date = new Date(endDate);
      filters.limit = limit;
      filters.offset = offset;

      const result = await alertManager.getAlerts(filters);

      // Summary stats
      const summary = {
        active: result.alerts.filter((a: any) => a.status === 'active').length,
        acknowledged: result.alerts.filter((a: any) => a.acknowledged && a.status === 'active').length,
        resolved: result.alerts.filter((a: any) => a.status === 'resolved').length
      };

      return void res.status(200).json({
        status: 'success',
        data: {
          alerts: result.alerts,
          pagination: {
            total: result.total,
            limit,
            offset
          },
          summary
        }
      });
    } catch (error) {
      logger.error({ error }, 'Error getting user alerts');
      return void res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  };

  const getUserAlertByIdController = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const meterId = req.query.meter_id as string | undefined;

      if (!meterId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Missing required query parameter: meter_id'
        });
      }

      const alert = await alertManager.getAlert(id);

      if (!alert) {
        return void res.status(404).json({
          status: 'error',
          message: `Alert not found: ${id}`
        });
      }

      // Verify the alert belongs to the user's meter
      if (alert.meter_id !== meterId) {
        return void res.status(403).json({
          status: 'error',
          message: 'Access denied: Alert does not belong to your meter'
        });
      }

      return void res.status(200).json({
        status: 'success',
        data: { alert }
      });
    } catch (error) {
      logger.error({ error }, 'Error getting user alert by ID');
      return void res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  };

  return {
    getUserAlertsController,
    getUserAlertByIdController
  };
};
