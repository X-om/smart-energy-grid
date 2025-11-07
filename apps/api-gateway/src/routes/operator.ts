import { Router, Response } from 'express';
import axios from 'axios';
import { authenticate, AuthenticatedRequest, requireRole } from '../middleware/auth.js';
import { postgresClient } from '../db/postgres.js';
import { timescaleClient } from '../db/timescale.js';
import { apiLogger as logger } from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import type { Router as RouterType } from 'express';

const router: RouterType = Router();

// All operator routes require OPERATOR or ADMIN role
router.use(authenticate);
router.use(requireRole('OPERATOR', 'ADMIN'));

/**
 * @swagger
 * /api/operator/alerts:
 *   get:
 *     summary: Get all active alerts (operator view)
 *     tags: [Operator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *       - in: query
 *         name: resolved
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Alerts retrieved
 */
router.get(
  '/alerts',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { region, severity, resolved = 'false' } = req.query;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const userId = req.user!.userId;

    // Validate pagination
    if (limit < 1 || limit > 1000) {
      return sendError(res, 'limit must be between 1 and 1000', 400);
    }

    if (offset < 0) {
      return sendError(res, 'offset must be non-negative', 400);
    }

    try {
      // Build query with filters
      let query = `
        SELECT 
          alert_id,
          meter_id,
          region,
          alert_type,
          severity,
          message,
          threshold_value,
          actual_value,
          created_at,
          resolved_at,
          is_resolved
        FROM alerts
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      // Filter by resolved status
      const isResolved = resolved === 'true';
      query += ` AND is_resolved = $${paramIndex}`;
      params.push(isResolved);
      paramIndex++;

      // Filter by region if provided
      if (region) {
        query += ` AND region = $${paramIndex}`;
        params.push(region);
        paramIndex++;
      }

      // Filter by severity if provided
      if (severity && ['low', 'medium', 'high', 'critical'].includes(severity as string)) {
        query += ` AND severity = $${paramIndex}`;
        params.push(severity);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await postgresClient.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM alerts WHERE is_resolved = $1';
      const countParams: any[] = [isResolved];
      let countIndex = 2;

      if (region) {
        countQuery += ` AND region = $${countIndex}`;
        countParams.push(region);
        countIndex++;
      }

      if (severity && ['low', 'medium', 'high', 'critical'].includes(severity as string)) {
        countQuery += ` AND severity = $${countIndex}`;
        countParams.push(severity);
      }

      const countResult = await postgresClient.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      logger.info('Operator alerts retrieved', {
        userId,
        count: result.rows.length,
        filters: { region, severity, resolved },
      });

      sendSuccess(res, {
        alerts: result.rows,
        meta: {
          limit,
          offset,
          total,
          filters: {
            region: region || null,
            severity: severity || null,
            resolved: isResolved,
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching operator alerts', { userId, error });
      return sendError(res, 'Failed to fetch alerts', 500);
    }
  })
);

/**
 * @swagger
 * /api/operator/grid/load:
 *   get:
 *     summary: Get region-wise grid load statistics
 *     tags: [Operator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         required: true
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         required: true
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [1m, 15m]
 *           default: 15m
 *     responses:
 *       200:
 *         description: Grid load statistics retrieved
 */
router.get(
  '/grid/load',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { from, to, granularity = '15m' } = req.query;
    const userId = req.user!.userId;

    // Validate parameters
    if (!from || !to) {
      return sendError(res, 'from and to query parameters are required', 400);
    }

    if (!['1m', '15m'].includes(granularity as string)) {
      return sendError(res, 'granularity must be either 1m or 15m', 400);
    }

    try {
      const tableName = granularity === '15m' ? 'aggregates_15m' : 'aggregates_1m';

      // Get region-wise aggregate load
      const query = `
        SELECT 
          region,
          window_start,
          SUM(avg_power_kw) as total_avg_power_kw,
          MAX(max_power_kw) as peak_power_kw,
          SUM(energy_kwh_sum) as total_energy_kwh,
          COUNT(DISTINCT meter_id) as active_meters
        FROM ${tableName}
        WHERE window_start >= $1::timestamp
          AND window_start <= $2::timestamp
        GROUP BY region, window_start
        ORDER BY region, window_start
      `;

      const result = await timescaleClient.query(query, [from, to]);

      // Calculate summary statistics per region
      const regionSummary: any = {};

      result.rows.forEach((row: any) => {
        if (!regionSummary[row.region]) {
          regionSummary[row.region] = {
            region: row.region,
            avgLoad: 0,
            peakLoad: 0,
            totalEnergy: 0,
            activeMeters: new Set(),
            dataPoints: 0,
          };
        }

        const summary = regionSummary[row.region];
        summary.avgLoad += parseFloat(row.total_avg_power_kw);
        summary.peakLoad = Math.max(summary.peakLoad, parseFloat(row.peak_power_kw));
        summary.totalEnergy += parseFloat(row.total_energy_kwh);
        summary.activeMeters.add(row.active_meters);
        summary.dataPoints++;
      });

      // Convert to array and calculate averages
      const summaryArray = Object.values(regionSummary).map((summary: any) => ({
        region: summary.region,
        avgLoad: summary.avgLoad / summary.dataPoints,
        peakLoad: summary.peakLoad,
        totalEnergy: summary.totalEnergy,
        activeMeterCount: summary.activeMeters.size,
      }));

      logger.info('Grid load statistics retrieved', {
        userId,
        granularity,
        dataPoints: result.rows.length,
        regions: summaryArray.length,
      });

      sendSuccess(res, {
        gridLoad: result.rows,
        summary: summaryArray,
        meta: {
          from,
          to,
          granularity,
          dataPoints: result.rows.length,
        },
      });
    } catch (error) {
      logger.error('Error fetching grid load statistics', { userId, error });
      return sendError(res, 'Failed to fetch grid load statistics', 500);
    }
  })
);

/**
 * @swagger
 * /api/operator/tariff/override:
 *   post:
 *     summary: Manually override tariff for a region
 *     tags: [Operator]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - region
 *               - pricePerKwh
 *               - reason
 *             properties:
 *               region:
 *                 type: string
 *               pricePerKwh:
 *                 type: number
 *               reason:
 *                 type: string
 *               effectiveFrom:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Tariff override successful
 */
router.post(
  '/tariff/override',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { region, pricePerKwh, reason, effectiveFrom } = req.body;
    const userId = req.user!.userId;

    // Validate input
    if (!region || !pricePerKwh || !reason) {
      return sendError(res, 'region, pricePerKwh, and reason are required', 400);
    }

    if (typeof pricePerKwh !== 'number' || pricePerKwh <= 0) {
      return sendError(res, 'pricePerKwh must be a positive number', 400);
    }

    try {
      const tariffServiceUrl = process.env.TARIFF_SERVICE_URL || 'http://localhost:3003';

      // Make request to Tariff Service
      const response = await axios.post(
        `${tariffServiceUrl}/operator/tariff/override`,
        {
          region,
          newPrice: pricePerKwh,
          reason,
          effectiveFrom: effectiveFrom || new Date().toISOString(),
          operatorId: userId,
        },
        {
          timeout: 5000,
        }
      );

      logger.info('Tariff override successful', {
        userId,
        region,
        pricePerKwh,
        reason,
      });

      sendSuccess(res, response.data, 'Tariff override successful');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Tariff service request failed', {
          userId,
          region,
          error: error.message,
          response: error.response?.data,
        });

        if (error.response) {
          return sendError(
            res,
            error.response.data?.error || 'Tariff service error',
            error.response.status
          );
        } else {
          return sendError(res, 'Failed to connect to Tariff Service', 503);
        }
      } else {
        logger.error('Unexpected error in tariff override', { userId, error });
        return sendError(res, 'Failed to override tariff', 500);
      }
    }
  })
);

/**
 * @swagger
 * /api/operator/statistics:
 *   get:
 *     summary: Get overall system statistics
 *     tags: [Operator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System statistics retrieved
 */
router.get(
  '/statistics',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    try {
      // Get alert statistics
      const alertStatsResult = await postgresClient.query(`
        SELECT 
          COUNT(*) as total_alerts,
          COUNT(*) FILTER (WHERE is_resolved = false) as active_alerts,
          COUNT(*) FILTER (WHERE severity = 'critical' AND is_resolved = false) as critical_alerts,
          COUNT(*) FILTER (WHERE severity = 'high' AND is_resolved = false) as high_alerts
        FROM alerts
      `);

      // Get user statistics
      const userStatsResult = await postgresClient.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(DISTINCT region) as unique_regions
        FROM users
      `);

      // Get recent activity (last hour)
      const recentActivityResult = await timescaleClient.query(`
        SELECT 
          COUNT(DISTINCT meter_id) as active_meters_last_hour,
          SUM(energy_kwh_sum) as total_energy_last_hour
        FROM aggregates_1m
        WHERE window_start >= NOW() - INTERVAL '1 hour'
      `);

      logger.info('System statistics retrieved', { userId });

      sendSuccess(res, {
        alerts: alertStatsResult.rows[0],
        users: userStatsResult.rows[0],
        recentActivity: recentActivityResult.rows[0],
      });
    } catch (error) {
      logger.error('Error fetching system statistics', { userId, error });
      return sendError(res, 'Failed to fetch system statistics', 500);
    }
  })
);

export default router;
