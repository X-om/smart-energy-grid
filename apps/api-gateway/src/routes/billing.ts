import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest, requireRole } from '../middleware/auth.js';
import { postgresClient } from '../db/postgres.js';
import { apiLogger as logger } from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import type { Router as RouterType } from 'express';

const router: RouterType = Router();

// All billing routes require authentication
router.use(authenticate);
router.use(requireRole('USER', 'OPERATOR', 'ADMIN'));

/**
 * @swagger
 * /api/billing/invoices:
 *   get:
 *     summary: Get user invoices
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, paid, overdue]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Invoices retrieved
 */
router.get(
  '/invoices',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { from, to, status } = req.query;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Validate pagination
    if (limit < 1 || limit > 100) {
      return sendError(res, 'limit must be between 1 and 100', 400);
    }

    if (offset < 0) {
      return sendError(res, 'offset must be non-negative', 400);
    }

    try {
      // Build query with optional filters
      let query = `
        SELECT 
          invoice_id,
          user_id,
          billing_period_start,
          billing_period_end,
          total_kwh,
          total_amount,
          currency,
          status,
          due_date,
          paid_date,
          created_at
        FROM invoices
        WHERE user_id = $1
      `;
      const params: any[] = [userId];
      let paramIndex = 2;

      if (from) {
        query += ` AND billing_period_start >= $${paramIndex}::timestamp`;
        params.push(from);
        paramIndex++;
      }

      if (to) {
        query += ` AND billing_period_end <= $${paramIndex}::timestamp`;
        params.push(to);
        paramIndex++;
      }

      if (status && ['pending', 'paid', 'overdue'].includes(status as string)) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      query += ` ORDER BY billing_period_start DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await postgresClient.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM invoices WHERE user_id = $1';
      const countParams: any[] = [userId];
      let countIndex = 2;

      if (from) {
        countQuery += ` AND billing_period_start >= $${countIndex}::timestamp`;
        countParams.push(from);
        countIndex++;
      }

      if (to) {
        countQuery += ` AND billing_period_end <= $${countIndex}::timestamp`;
        countParams.push(to);
        countIndex++;
      }

      if (status && ['pending', 'paid', 'overdue'].includes(status as string)) {
        countQuery += ` AND status = $${countIndex}`;
        countParams.push(status);
      }

      const countResult = await postgresClient.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      logger.info('Invoices retrieved', {
        userId,
        count: result.rows.length,
        filters: { from, to, status },
      });

      sendSuccess(res, {
        invoices: result.rows,
        meta: {
          limit,
          offset,
          total,
          filters: {
            from: from || null,
            to: to || null,
            status: status || null,
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching invoices', { userId, error });
      return sendError(res, 'Failed to fetch invoices', 500);
    }
  })
);

/**
 * @swagger
 * /api/billing/invoice/{id}:
 *   get:
 *     summary: Get detailed invoice with breakdown
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice details retrieved
 *       404:
 *         description: Invoice not found
 */
router.get(
  '/invoice/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    try {
      // Fetch invoice
      const invoiceResult = await postgresClient.query(
        `SELECT 
          invoice_id,
          user_id,
          billing_period_start,
          billing_period_end,
          total_kwh,
          total_amount,
          currency,
          status,
          due_date,
          paid_date,
          created_at,
          updated_at
         FROM invoices
         WHERE invoice_id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (invoiceResult.rows.length === 0) {
        return sendError(res, 'Invoice not found', 404);
      }

      const invoice = invoiceResult.rows[0];

      // Fetch line items (breakdown by time period or tariff)
      const lineItemsResult = await postgresClient.query(
        `SELECT 
          line_item_id,
          invoice_id,
          description,
          period_start,
          period_end,
          kwh_consumed,
          rate_per_kwh,
          amount,
          created_at
         FROM invoice_line_items
         WHERE invoice_id = $1
         ORDER BY period_start ASC`,
        [id]
      );

      logger.info('Invoice details retrieved', {
        userId,
        invoiceId: id,
        lineItems: lineItemsResult.rows.length,
      });

      sendSuccess(res, {
        invoice: {
          ...invoice,
          lineItems: lineItemsResult.rows,
        },
      });
    } catch (error) {
      logger.error('Error fetching invoice details', { userId, invoiceId: id, error });
      return sendError(res, 'Failed to fetch invoice details', 500);
    }
  })
);

/**
 * @swagger
 * /api/billing/summary:
 *   get:
 *     summary: Get billing summary for user
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Billing summary retrieved
 */
router.get(
  '/summary',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    try {
      // Get total statistics
      const summaryResult = await postgresClient.query(
        `SELECT 
          COUNT(*) as total_invoices,
          COUNT(*) FILTER (WHERE status = 'paid') as paid_invoices,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_invoices,
          COUNT(*) FILTER (WHERE status = 'overdue') as overdue_invoices,
          COALESCE(SUM(total_amount) FILTER (WHERE status = 'paid'), 0) as total_paid,
          COALESCE(SUM(total_amount) FILTER (WHERE status = 'pending'), 0) as total_pending,
          COALESCE(SUM(total_amount) FILTER (WHERE status = 'overdue'), 0) as total_overdue,
          COALESCE(SUM(total_kwh), 0) as total_kwh_consumed
         FROM invoices
         WHERE user_id = $1`,
        [userId]
      );

      const summary = summaryResult.rows[0];

      // Get recent invoices (last 3)
      const recentResult = await postgresClient.query(
        `SELECT 
          invoice_id,
          billing_period_start,
          billing_period_end,
          total_kwh,
          total_amount,
          currency,
          status,
          due_date
         FROM invoices
         WHERE user_id = $1
         ORDER BY billing_period_start DESC
         LIMIT 3`,
        [userId]
      );

      logger.info('Billing summary retrieved', { userId });

      sendSuccess(res, {
        summary: {
          totalInvoices: parseInt(summary.total_invoices),
          paidInvoices: parseInt(summary.paid_invoices),
          pendingInvoices: parseInt(summary.pending_invoices),
          overdueInvoices: parseInt(summary.overdue_invoices),
          totalPaid: parseFloat(summary.total_paid),
          totalPending: parseFloat(summary.total_pending),
          totalOverdue: parseFloat(summary.total_overdue),
          totalKwhConsumed: parseFloat(summary.total_kwh_consumed),
        },
        recentInvoices: recentResult.rows,
      });
    } catch (error) {
      logger.error('Error fetching billing summary', { userId, error });
      return sendError(res, 'Failed to fetch billing summary', 500);
    }
  })
);

export default router;
