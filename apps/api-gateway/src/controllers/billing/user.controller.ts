import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';
import { billingService } from '../../services/database/billing.service';
import { getUserById } from '../../services/database/user.service';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { InvoiceStatus } from '../../types/invoice.types';
import { timescalePool } from '../../utils/db';

// * GET /api/v1/billing/invoices
export const getUserInvoices = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const { limit = 20, offset = 0, status, start_date, end_date } = req.query;

    const options = {
      limit: Number(limit),
      offset: Number(offset),
      status: status as InvoiceStatus | undefined,
      start_date: start_date ? new Date(start_date as string) : undefined,
      end_date: end_date ? new Date(end_date as string) : undefined,
    };

    const result = await billingService.getUserInvoices(userId, options);

    successResponse(res, 200, 'Invoices retrieved successfully', {
      invoices: result.invoices,
      pagination: {
        total: result.total,
        limit: options.limit,
        offset: options.offset,
        has_more: result.total > options.offset + options.limit,
      },
    });
  }
);

// * GET /api/v1/billing/invoices/:invoiceId
export const getInvoiceDetails = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const { invoiceId } = req.params;
    const invoice = await billingService.getInvoiceWithLineItems(invoiceId, userId);

    successResponse(res, 200, 'Invoice retrieved successfully', { invoice });
  }
);

// * GET /api/v1/billing/invoices/:invoiceId/pdf
export const downloadInvoicePDF = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const { invoiceId } = req.params;
    const invoice = await billingService.getInvoiceById(invoiceId, userId);

    if (!invoice.pdf_url) throw new NotFoundError('PDF not available for this invoice');

    successResponse(res, 200, 'PDF URL retrieved successfully', {
      pdf_url: invoice.pdf_url,
      invoice_number: invoice.invoice_number,
    });
  }
);

// * GET /api/v1/billing/current-cycle
export const getCurrentCycle = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const user = await getUserById(userId);

    if (!user || !user.meter_id) throw new BadRequestError('User does not have an assigned meter');

    const cycleInfo = await billingService.getCurrentBillingCycle(userId, user.meter_id);
    const now = new Date();
    const estimatedConsumption = await getEstimatedConsumption(user.meter_id, cycleInfo.cycle_start, now);

    successResponse(res, 200, 'Current billing cycle retrieved successfully', {
      cycle_start: cycleInfo.cycle_start,
      cycle_end: cycleInfo.cycle_end,
      days_remaining: cycleInfo.days_remaining,
      estimated_consumption_kwh: estimatedConsumption,
      current_month_invoice: cycleInfo.current_month_invoice,
    });
  }
);

// * GET /api/v1/billing/estimated
export const getEstimatedBill = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const user = await getUserById(userId);

    if (!user || !user.meter_id) throw new BadRequestError('User does not have an assigned meter');

    const meterId = user.meter_id;
    const now = new Date();
    const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const totalDays = Math.ceil((cycleEnd.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil((now.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
    const consumptionToDate = await getEstimatedConsumption(meterId, cycleStart, now);
    const projectedConsumption = (consumptionToDate / daysElapsed) * totalDays;

    // Fetch actual tariff rate from database based on user's region
    const avgRate = await getAverageTariffRate(user.region);
    const estimatedBaseCost = projectedConsumption * avgRate;
    const estimatedTax = estimatedBaseCost * 0.18; // 18% GST for India
    const estimatedTotal = estimatedBaseCost + estimatedTax;

    let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
    if (daysElapsed > 20) confidenceLevel = 'high';
    else if (daysElapsed > 10) confidenceLevel = 'medium';

    successResponse(res, 200, 'Estimated bill calculated successfully', {
      period_start: cycleStart, period_end: cycleEnd, days_elapsed: daysElapsed, total_days: totalDays,
      consumption_to_date_kwh: consumptionToDate, projected_consumption_kwh: projectedConsumption,
      avg_tariff_rate: avgRate, estimated_base_cost: estimatedBaseCost, estimated_tax: estimatedTax,
      estimated_total: estimatedTotal, currency: 'INR', confidence_level: confidenceLevel,
      tax_rate: 0.18, tax_note: 'Includes 18% GST'
    });
  }
);

// * GET /api/v1/billing/payment-history
export const getPaymentHistory = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const { limit = 20, offset = 0 } = req.query;
    const result = await billingService.getPaymentHistory(userId, Number(limit), Number(offset));

    successResponse(res, 200, 'Payment history retrieved successfully', {
      payments: result.payments,
      pagination: {
        total: result.total, limit: Number(limit), offset: Number(offset),
        has_more: result.total > Number(offset) + Number(limit),
      },
    });
  }
);

// * PUT /api/v1/billing/invoices/:invoiceId/paid
export const markInvoiceAsPaid = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const { invoiceId } = req.params;
    const invoice = await billingService.markInvoiceAsPaid(invoiceId, userId, req.body);

    successResponse(res, 200, 'Invoice marked as paid successfully', { invoice });
  }
);

// * POST /api/v1/billing/invoices/:invoiceId/dispute
export const disputeInvoice = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const { invoiceId } = req.params;
    const invoice = await billingService.disputeInvoice(invoiceId, userId, req.body);

    successResponse(res, 200, 'Invoice disputed successfully', { invoice });
  }
);

async function getEstimatedConsumption(meterId: string, startDate: Date, endDate: Date): Promise<number> {
  try {
    // Calculate energy from average power: Energy (kWh) = Power (kW) × Time (hours)
    // For 1-minute aggregates: Energy per reading = avg_power_kw × (1/60)
    const query = `
      SELECT COALESCE(SUM(avg_power_kw * (1.0/60.0)), 0) as total_consumption
      FROM aggregates_1m
      WHERE meter_id = $1 AND window_start >= $2 AND window_start <= $3
    `;
    const result = await timescalePool.query(query, [meterId, startDate, endDate]);
    return parseFloat(result.rows[0]?.total_consumption || '0');
  } catch (error) {
    console.error('Error calculating consumption:', error);
    return 0;
  }
}

async function getAverageTariffRate(region: string): Promise<number> {
  try {
    const { postgresPool } = await import('../../utils/db');
    const query = `
      SELECT AVG(price_per_kwh) as avg_rate
      FROM tariffs
      WHERE region = $1 AND is_active = true
    `;
    const result = await postgresPool.query(query, [region]);
    return parseFloat(result.rows[0]?.avg_rate || '6.5');
  } catch (error) {
    console.error('Error fetching tariff rate:', error);
    return 6.5; // Fallback rate
  }
}
