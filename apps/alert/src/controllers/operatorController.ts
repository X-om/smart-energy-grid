import { Request, Response } from 'express';
import { createLogger } from '../utils/logger.js';
import type { AlertManagerService } from '../services/alertManagerService.js';

const logger = createLogger('operator-controller');

export const createOperatorController = (alertManager: AlertManagerService) => {

  const getAlertsController = async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const severity = req.query.severity as string | undefined;
      const type = req.query.type as string | undefined;
      const region = req.query.region as string | undefined;

      const filters: any = {};
      if (severity) filters.severity = severity;
      if (type) filters.type = type;
      if (region) filters.region = region;
      filters.limit = limit;
      filters.offset = offset;

      const result = await alertManager.getAlerts(filters);

      return void res.status(200).json({
        status: 'success',
        data: { count: result.total, alerts: result.alerts }
      });
    } catch (error) {
      logger.error({ error }, 'Error getting alerts');
      return void res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  };

  const getActiveAlertsController = async (req: Request, res: Response): Promise<void> => {
    try {
      const region = req.query.region as string | undefined;
      const alerts = await alertManager.getActiveAlerts(region);

      return void res.status(200).json({
        status: 'success',
        data: { count: alerts.length, alerts }
      });
    } catch (error) {
      logger.error({ error }, 'Error getting active alerts');
      return void res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  };

  const getAlertHistoryController = async (req: Request, res: Response): Promise<void> => {
    try {
      const { region } = req.params;
      const hours = parseInt(req.query.hours as string) || 24;
      const severity = req.query.severity as string | undefined;

      const filters: any = { region };
      if (severity) filters.severity = severity;
      filters.hours = hours;

      const result = await alertManager.getAlertHistory(filters);

      return void res.status(200).json({
        status: 'success',
        data: { region, hours, count: result.total, alerts: result.alerts }
      });
    } catch (error) {
      logger.error({ error }, 'Error getting alert history');
      return void res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  };

  const getAlertByIdController = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const alert = await alertManager.getAlert(id);

      if (!alert) {
        return void res.status(404).json({
          status: 'error',
          message: `Alert not found: ${id}`
        });
      }

      return void res.status(200).json({
        status: 'success',
        data: { alert }
      });
    } catch (error) {
      logger.error({ error }, 'Error getting alert by ID');
      return void res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  };

  const acknowledgeAlertController = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { operatorId, notes } = req.body;

      if (!operatorId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Missing required field: operatorId'
        });
      }

      const updated = await alertManager.acknowledgeAlert(id, {
        acknowledged_by: operatorId,
        acknowledged_at: new Date(),
        note: notes
      });

      if (!updated) {
        return void res.status(404).json({
          status: 'error',
          message: `Alert not found: ${id}`
        });
      }

      return void res.status(200).json({
        status: 'success',
        message: 'Alert acknowledged successfully',
        data: { alert: updated }
      });
    } catch (error) {
      logger.error({ error }, 'Error acknowledging alert');
      return void res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  };

  const resolveAlertController = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { operatorId, resolution } = req.body;

      if (!operatorId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Missing required field: operatorId'
        });
      }

      const updated = await alertManager.resolveAlert(id, {
        resolved_by: operatorId,
        resolved_at: new Date(),
        resolution_note: resolution
      });

      if (!updated) {
        return void res.status(404).json({
          status: 'error',
          message: `Alert not found: ${id}`
        });
      }

      return void res.status(200).json({
        status: 'success',
        message: 'Alert resolved successfully',
        data: { alert: updated }
      });
    } catch (error) {
      logger.error({ error }, 'Error resolving alert');
      return void res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  };

  const bulkResolveAlertsController = async (req: Request, res: Response): Promise<void> => {
    try {
      const { alertIds, operatorId, resolution } = req.body;

      if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
        return void res.status(400).json({
          status: 'error',
          message: 'Missing or invalid field: alertIds (must be non-empty array)'
        });
      }

      if (!operatorId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Missing required field: operatorId'
        });
      }

      const alerts = await alertManager.bulkResolveAlerts(alertIds, {
        resolved_by: operatorId,
        resolved_at: new Date(),
        resolution_note: resolution
      });
      const count = alerts.length;

      return void res.status(200).json({
        status: 'success',
        message: `Resolved ${count} alerts`,
        data: { resolvedCount: count }
      });
    } catch (error) {
      logger.error({ error }, 'Error bulk resolving alerts');
      return void res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  };

  const getAlertStatsController = async (_req: Request, res: Response): Promise<void> => {
    try {
      const stats = await alertManager.getStatistics();

      return void res.status(200).json({
        status: 'success',
        data: { statistics: stats }
      });
    } catch (error) {
      logger.error({ error }, 'Error getting alert statistics');
      return void res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  };

  const autoResolveOldAlertsController = async (req: Request, res: Response): Promise<void> => {
    try {
      const hours = parseInt(req.query.hours as string) || 48;
      const count = await alertManager.autoResolveOldAlerts(hours);

      return void res.status(200).json({
        status: 'success',
        message: `Auto-resolved ${count} old alerts`,
        data: { resolvedCount: count, hoursThreshold: hours }
      });
    } catch (error) {
      logger.error({ error }, 'Error auto-resolving old alerts');
      return void res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  };

  return {
    getAlertsController,
    getActiveAlertsController,
    getAlertHistoryController,
    getAlertByIdController,
    acknowledgeAlertController,
    resolveAlertController,
    bulkResolveAlertsController,
    getAlertStatsController,
    autoResolveOldAlertsController
  };
};
