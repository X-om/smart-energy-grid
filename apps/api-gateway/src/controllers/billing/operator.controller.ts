import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';
import { billingService } from '../../services/database/billing.service';
import { BadRequestError } from '../../utils/errors';
import { InvoiceStatus } from '../../types/invoice.types';

// * GET /api/v1/billing/operator/overdue/:region
export const getOverdueInvoices = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { region } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const result = await billingService.getOverdueInvoicesByRegion(region, Number(limit), Number(offset));

    successResponse(res, 200, 'Overdue invoices retrieved successfully', {
      region, invoices: result.invoices,
      pagination: {
        total: result.total, limit: Number(limit), offset: Number(offset),
        has_more: result.total > Number(offset) + Number(limit),
      },
    });
  }
);

// * GET /api/v1/billing/operator/analytics
export const getInvoiceAnalytics = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { region, start_date, end_date } = req.query;
    const startDate = start_date ? new Date(start_date as string) : undefined;
    const endDate = end_date ? new Date(end_date as string) : undefined;
    const analytics = await billingService.getInvoiceAnalytics(region as string | undefined, startDate, endDate);

    successResponse(res, 200, 'Invoice analytics retrieved successfully', { analytics });
  }
);

// * POST /api/v1/billing/operator/generate-monthly
export const generateMonthlyInvoices = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { year, month, region } = req.body;

    if (!year || !month) throw new BadRequestError('Year and month are required');
    if (month < 1 || month > 12) throw new BadRequestError('Month must be between 1 and 12');
    if (year < 2020 || year > 2100) throw new BadRequestError('Invalid year');

    let result;

    if (region) result = await billingService.generateMonthlyInvoicesForRegion(region, year, month);
    else {
      const regions = [
        'Mumbai-North', 'Mumbai-South', 'Delhi-North', 'Delhi-South',
        'Bangalore-East', 'Bangalore-West', 'Pune-East', 'Pune-West',
        'Hyderabad-Central', 'Chennai-North'
      ];

      let totalSuccess = 0;
      let totalFailed = 0;
      const allErrors: string[] = [];

      for (const reg of regions) {
        const regionResult = await billingService.generateMonthlyInvoicesForRegion(reg, year, month);
        totalSuccess += regionResult.success;
        totalFailed += regionResult.failed;
        allErrors.push(...regionResult.errors.map(err => `[${reg}] ${err}`));
      }

      result = { success: totalSuccess, failed: totalFailed, errors: allErrors };
    }

    const message = region ? `Monthly invoices generated for ${region}` : 'Monthly invoices generated for all regions';

    successResponse(res, 200, message, {
      year, month, region: region || 'all',
      summary: { success: result.success, failed: result.failed, total: result.success + result.failed },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  }
);

// * GET /api/v1/billing/operator/export
export const exportInvoiceData = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { start_date, end_date, region, status, format = 'csv' } = req.query;

    const options = {
      start_date: start_date ? new Date(start_date as string) : undefined,
      end_date: end_date ? new Date(end_date as string) : undefined,
      region: region as string | undefined,
      status: status as InvoiceStatus | undefined,
    };

    if (format === 'csv') {
      const csv = await billingService.exportInvoicesCSV(options);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=invoices.csv');
      res.send(csv);
    } else {
      const result = await billingService.getUserInvoices('', { ...options, limit: 10000, offset: 0 });
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=invoices.json');
      res.json({
        success: true,
        data: {
          invoices: result.invoices, total: result.total,
          exported_at: new Date().toISOString(), filters: options,
        },
      });
    }
  }
);
