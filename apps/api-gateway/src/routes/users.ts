import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest, requireRole } from '../middleware/auth.js';
import { postgresClient } from '../db/postgres.js';
import { timescaleClient } from '../db/timescale.js';
import { redisClient } from '../db/redis.js';
import { apiLogger as logger } from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import type { Router as RouterType } from 'express';

const router: RouterType = Router();

// All user routes require authentication
router.use(authenticate);
router.use(requireRole('USER', 'OPERATOR', 'ADMIN'));

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 */
router.get(
  '/me',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    try {
      const result = await postgresClient.query(
        `SELECT user_id, email, name, role, region, meter_id, created_at
         FROM users
         WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return sendError(res, 'User not found', 404);
      }

      const user = result.rows[0];

      logger.info('User profile retrieved', { userId });

      sendSuccess(res, {
        userId: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role,
        region: user.region,
        meterId: user.meter_id,
        createdAt: user.created_at,
      });
    } catch (error) {
      logger.error('Error fetching user profile', { userId, error });
      return sendError(res, 'Failed to fetch user profile', 500);
    }
  })
);

/**
 * @swagger
 * /api/users/me/consumption:
 *   get:
 *     summary: Get user consumption data
 *     tags: [Users]
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
 *           default: 1m
 *     responses:
 *       200:
 *         description: Consumption data retrieved
 */
router.get(
  '/me/consumption',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { from, to, granularity = '1m' } = req.query;
    const userId = req.user!.userId;
    const userRegion = req.user!.region;
    const userMeterId = req.user!.meterId;

    // Validate parameters
    if (!from || !to) {
      return sendError(res, 'from and to query parameters are required', 400);
    }

    if (!['1m', '15m'].includes(granularity as string)) {
      return sendError(res, 'granularity must be either 1m or 15m', 400);
    }

    try {
      const tableName = granularity === '15m' ? 'aggregates_15m' : 'aggregates_1m';

      // Build query based on available user data
      let query: string;
      let params: any[];

      if (userMeterId) {
        // If user has a meter ID, fetch data for that specific meter
        query = `
          SELECT 
            window_start,
            meter_id,
            avg_power_kw,
            max_power_kw,
            min_power_kw,
            energy_kwh_sum,
            voltage_avg,
            current_avg
          FROM ${tableName}
          WHERE meter_id = $1
            AND window_start >= $2::timestamp
            AND window_start <= $3::timestamp
          ORDER BY window_start ASC
        `;
        params = [userMeterId, from, to];
      } else if (userRegion) {
        // If user has a region, aggregate data for that region
        query = `
          SELECT 
            window_start,
            region,
            SUM(avg_power_kw) as avg_power_kw,
            MAX(max_power_kw) as max_power_kw,
            MIN(min_power_kw) as min_power_kw,
            SUM(energy_kwh_sum) as energy_kwh_sum,
            AVG(voltage_avg) as voltage_avg,
            AVG(current_avg) as current_avg
          FROM ${tableName}
          WHERE region = $1
            AND window_start >= $2::timestamp
            AND window_start <= $3::timestamp
          GROUP BY window_start, region
          ORDER BY window_start ASC
        `;
        params = [userRegion, from, to];
      } else {
        return sendError(res, 'User has no associated meter or region', 400);
      }

      const result = await timescaleClient.query(query, params);

      logger.info('Consumption data retrieved', {
        userId,
        region: userRegion,
        meterId: userMeterId,
        granularity,
        recordCount: result.rows.length,
      });

      sendSuccess(res, {
        consumption: result.rows,
        meta: {
          from,
          to,
          granularity,
          recordCount: result.rows.length,
          region: userRegion,
          meterId: userMeterId,
        },
      });
    } catch (error) {
      logger.error('Error fetching consumption data', { userId, error });
      return sendError(res, 'Failed to fetch consumption data', 500);
    }
  })
);

/**
 * @swagger
 * /api/users/me/tariff/current:
 *   get:
 *     summary: Get current tariff for user's region
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current tariff retrieved
 */
router.get(
  '/me/tariff/current',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const userRegion = req.user!.region;

    if (!userRegion) {
      return sendError(res, 'User has no associated region', 400);
    }

    try {
      // Try to fetch from Redis cache first
      const cacheKey = `tariff:current:${userRegion}`;
      const cachedTariff = await redisClient.getJSON(cacheKey);

      if (cachedTariff) {
        logger.debug('Tariff fetched from cache', { userId, region: userRegion });
        return sendSuccess(res, { tariff: cachedTariff, source: 'cache' });
      }

      // Fetch from database if not in cache
      const result = await postgresClient.query(
        `SELECT 
          tariff_id,
          region,
          time_of_day,
          price_per_kwh,
          effective_from,
          effective_to,
          is_active
         FROM tariffs
         WHERE region = $1
           AND is_active = true
           AND effective_from <= NOW()
           AND (effective_to IS NULL OR effective_to >= NOW())
         ORDER BY effective_from DESC
         LIMIT 1`,
        [userRegion]
      );

      if (result.rows.length === 0) {
        logger.warn('No active tariff found for region', { userId, region: userRegion });
        return sendError(res, 'No active tariff found for your region', 404);
      }

      const tariff = result.rows[0];

      // Cache the result for 60 seconds
      await redisClient.setJSON(cacheKey, tariff, 60);

      logger.info('Current tariff retrieved', { userId, region: userRegion });

      sendSuccess(res, { tariff, source: 'database' });
    } catch (error) {
      logger.error('Error fetching current tariff', { userId, region: userRegion, error });
      return sendError(res, 'Failed to fetch current tariff', 500);
    }
  })
);

/**
 * @swagger
 * /api/users/me/alerts:
 *   get:
 *     summary: Get active alerts for user's region
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
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
  '/me/alerts',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const userRegion = req.user!.region;
    const userMeterId = req.user!.meterId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Validate pagination
    if (limit < 1 || limit > 100) {
      return sendError(res, 'limit must be between 1 and 100', 400);
    }

    if (offset < 0) {
      return sendError(res, 'offset must be non-negative', 400);
    }

    try {
      // Build query to fetch alerts related to user
      let query: string;
      let params: any[];

      if (userMeterId) {
        // Fetch alerts for specific meter
        query = `
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
          WHERE meter_id = $1
            AND is_resolved = false
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3
        `;
        params = [userMeterId, limit, offset];
      } else if (userRegion) {
        // Fetch alerts for region
        query = `
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
          WHERE region = $1
            AND is_resolved = false
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3
        `;
        params = [userRegion, limit, offset];
      } else {
        return sendError(res, 'User has no associated meter or region', 400);
      }

      const result = await postgresClient.query(query, params);

      // Get total count
      const countQuery = userMeterId
        ? 'SELECT COUNT(*) FROM alerts WHERE meter_id = $1 AND is_resolved = false'
        : 'SELECT COUNT(*) FROM alerts WHERE region = $1 AND is_resolved = false';
      const countParams = userMeterId ? [userMeterId] : [userRegion];
      const countResult = await postgresClient.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      logger.info('Alerts retrieved', {
        userId,
        region: userRegion,
        meterId: userMeterId,
        count: result.rows.length,
      });

      sendSuccess(res, {
        alerts: result.rows,
        meta: {
          limit,
          offset,
          total,
          region: userRegion,
          meterId: userMeterId,
        },
      });
    } catch (error) {
      logger.error('Error fetching alerts', { userId, error });
      return sendError(res, 'Failed to fetch alerts', 500);
    }
  })
);

export default router;
