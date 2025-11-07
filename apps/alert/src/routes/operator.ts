import { Router, Request, Response } from 'express';
import { alertManager, AlertAcknowledgment, AlertResolution } from '../services/alertManager.js';
import { AlertFilters } from '../db/postgres.js';
import { apiLogger as logger } from '../utils/logger.js';

const router: Router = Router();

// Middleware for request logging
router.use((req: Request, res: Response, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('API request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });

  next();
});

// Helper function to validate UUID
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Helper function to parse query parameters
const parseFilters = (query: any): AlertFilters => {
  const filters: AlertFilters = {};

  if (query.status && typeof query.status === 'string') {
    filters.status = query.status;
  }

  if (query.type && typeof query.type === 'string') {
    filters.type = query.type;
  }

  if (query.region && typeof query.region === 'string') {
    filters.region = query.region;
  }

  if (query.meter_id && typeof query.meter_id === 'string') {
    filters.meter_id = query.meter_id;
  }

  if (query.acknowledged !== undefined) {
    filters.acknowledged = query.acknowledged === 'true';
  }

  if (query.from_date && typeof query.from_date === 'string') {
    const fromDate = new Date(query.from_date);
    if (!isNaN(fromDate.getTime())) {
      filters.from_date = fromDate;
    }
  }

  if (query.to_date && typeof query.to_date === 'string') {
    const toDate = new Date(query.to_date);
    if (!isNaN(toDate.getTime())) {
      filters.to_date = toDate;
    }
  }

  if (query.limit && typeof query.limit === 'string') {
    const limit = parseInt(query.limit, 10);
    if (limit > 0 && limit <= 1000) {
      filters.limit = limit;
    }
  }

  if (query.offset && typeof query.offset === 'string') {
    const offset = parseInt(query.offset, 10);
    if (offset >= 0) {
      filters.offset = offset;
    }
  }

  return filters;
};

/**
 * GET /operator/alerts
 * Get alerts with optional filtering
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const filters = parseFilters(req.query);

    logger.debug('Getting alerts', { filters });

    const result = await alertManager.getAlerts(filters);

    return res.json({
      success: true,
      data: {
        alerts: result.alerts,
        total: result.total,
        filters: filters,
        pagination: {
          limit: filters.limit || 50,
          offset: filters.offset || 0,
          has_more: (filters.offset || 0) + result.alerts.length < result.total
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get alerts:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /operator/alerts/active
 * Get active alerts only
 */
router.get('/alerts/active', async (req: Request, res: Response) => {
  try {
    const region = req.query.region as string;

    logger.debug('Getting active alerts', { region });

    const alerts = await alertManager.getActiveAlerts(region);

    return res.json({
      success: true,
      data: {
        alerts,
        total: alerts.length,
        region: region || 'all'
      }
    });

  } catch (error) {
    logger.error('Failed to get active alerts:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve active alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /operator/alerts/history
 * Get alert history (resolved alerts)
 */
router.get('/alerts/history', async (req: Request, res: Response) => {
  try {
    const filters = parseFilters(req.query);

    logger.debug('Getting alert history', { filters });

    const result = await alertManager.getAlertHistory(filters);

    return res.json({
      success: true,
      data: {
        alerts: result.alerts,
        total: result.total,
        filters: filters,
        pagination: {
          limit: filters.limit || 50,
          offset: filters.offset || 0,
          has_more: (filters.offset || 0) + result.alerts.length < result.total
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get alert history:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve alert history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /operator/alerts/:id
 * Get specific alert by ID
 */
router.get('/alerts/:id', async (req: Request, res: Response): Promise<Response> => {
  try {
    const alertId = req.params.id;
    
    if (!isValidUUID(alertId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alert ID format',
        message: 'Alert ID must be a valid UUID'
      });
    }
    
    logger.debug('Getting alert by ID', { alertId });
    
    const alert = await alertManager.getAlert(alertId);
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
        message: `Alert with ID ${alertId} does not exist`
      });
    }
    
    return res.json({
      success: true,
      data: { alert }
    });
    
  } catch (error) {
    logger.error('Failed to get alert:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});/**
 * POST /operator/alerts/:id/ack
 * Acknowledge an alert
 */
router.post('/alerts/:id/ack', async (req: Request, res: Response): Promise<Response> => {
  try {
    const alertId = req.params.id;
    const { acknowledged_by, note } = req.body;

    if (!isValidUUID(alertId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alert ID format',
        message: 'Alert ID must be a valid UUID'
      });
    }

    if (!acknowledged_by || typeof acknowledged_by !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        message: 'acknowledged_by field is required and must be a string'
      });
    }

    logger.info('Acknowledging alert', { alertId, acknowledgedBy: acknowledged_by });

    const acknowledgment: AlertAcknowledgment = {
      acknowledged_by,
      acknowledged_at: new Date(),
      note
    };

    const alert = await alertManager.acknowledgeAlert(alertId, acknowledgment);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
        message: `Alert with ID ${alertId} does not exist`
      });
    }

    return res.json({
      success: true,
      data: { alert },
      message: 'Alert acknowledged successfully'
    });
    
  } catch (error) {
    logger.error('Failed to acknowledge alert:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});/**
 * POST /operator/alerts/:id/resolve
 * Resolve an alert
 */
router.post('/alerts/:id/resolve', async (req: Request, res: Response): Promise<Response> => {
  try {
    const alertId = req.params.id;
    const { resolved_by, resolution_note } = req.body;

    if (!isValidUUID(alertId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alert ID format',
        message: 'Alert ID must be a valid UUID'
      });
    }

    if (!resolved_by || typeof resolved_by !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        message: 'resolved_by field is required and must be a string'
      });
    }

    logger.info('Resolving alert', { alertId, resolvedBy: resolved_by });

    const resolution: AlertResolution = {
      resolved_by,
      resolved_at: new Date(),
      resolution_note
    };

    const alert = await alertManager.resolveAlert(alertId, resolution);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
        message: `Alert with ID ${alertId} does not exist`
      });
    }

    return res.json({
      success: true,
      data: { alert },
      message: 'Alert resolved successfully'
    });

  } catch (error) {
    logger.error('Failed to resolve alert:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to resolve alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /operator/alerts/bulk/resolve
 * Bulk resolve multiple alerts
 */
router.post('/alerts/bulk/resolve', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { alert_ids, resolved_by, resolution_note } = req.body;

    if (!Array.isArray(alert_ids) || alert_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        message: 'alert_ids must be a non-empty array'
      });
    }

    if (!resolved_by || typeof resolved_by !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        message: 'resolved_by field is required and must be a string'
      });
    }

    // Validate all alert IDs
    for (const alertId of alert_ids) {
      if (!isValidUUID(alertId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alert ID format',
          message: `Alert ID ${alertId} is not a valid UUID`
        });
      }
    }

    logger.info('Bulk resolving alerts', {
      alertIds: alert_ids,
      resolvedBy: resolved_by,
      count: alert_ids.length
    });

    const resolution: AlertResolution = {
      resolved_by,
      resolved_at: new Date(),
      resolution_note
    };

    const resolvedAlerts = await alertManager.bulkResolveAlerts(alert_ids, resolution);

    return res.json({
      success: true,
      data: {
        resolved_alerts: resolvedAlerts,
        requested_count: alert_ids.length,
        resolved_count: resolvedAlerts.length
      },
      message: `Successfully resolved ${resolvedAlerts.length} out of ${alert_ids.length} alerts`
    });

  } catch (error) {
    logger.error('Failed to bulk resolve alerts:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to bulk resolve alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /operator/alerts/stats
 * Get alert statistics
 */
router.get('/alerts/stats', async (req: Request, res: Response) => {
  try {
    const region = req.query.region as string;

    logger.debug('Getting alert statistics', { region });

    const stats = await alertManager.getStatistics(region);

    return res.json({
      success: true,
      data: {
        statistics: stats,
        region: region || 'all',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to get alert statistics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve alert statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /operator/alerts/auto-resolve
 * Auto-resolve old alerts
 */
router.post('/alerts/auto-resolve', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { max_age_hours = 24 } = req.body;

    if (typeof max_age_hours !== 'number' || max_age_hours <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        message: 'max_age_hours must be a positive number'
      });
    }

    logger.info('Auto-resolving old alerts', { maxAgeHours: max_age_hours });

    const resolvedCount = await alertManager.autoResolveOldAlerts(max_age_hours);

    return res.json({
      success: true,
      data: {
        resolved_count: resolvedCount,
        max_age_hours
      },
      message: `Auto-resolved ${resolvedCount} old alerts`
    });

  } catch (error) {
    logger.error('Failed to auto-resolve old alerts:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to auto-resolve old alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /operator/health
 * Health check endpoint
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const healthy = await alertManager.healthCheck();

    if (healthy) {
      return res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          service: 'alert-service'
        }
      });
    } else {
      return res.status(503).json({
        success: false,
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          service: 'alert-service'
        }
      });
    }

  } catch (error) {
    logger.error('Health check failed:', error);
    return res.status(503).json({
      success: false,
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;