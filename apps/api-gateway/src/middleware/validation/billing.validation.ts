import { z } from 'zod';
import { validateRequest, validateQuery, validateParams } from '../../utils/validators';

const invoiceStatusSchema = z.enum(['pending', 'paid', 'overdue', 'disputed', 'cancelled']);
const uuidSchema = z.string().uuid('Invalid invoice ID format');

export const validateGetInvoices = validateQuery(
  z.object({
    limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
    offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0)).optional(),
    status: invoiceStatusSchema.optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
  })
);

export const validateInvoiceId = validateParams(z.object({ invoiceId: uuidSchema, }));

export const validateMarkInvoicePaid = validateRequest(
  z.object({
    payment_method: z.string().min(1, 'Payment method is required').max(50),
    payment_reference: z.string().max(100).optional(),
    paid_at: z.string().datetime().optional(),
    notes: z.string().max(1000).optional(),
  })
);

export const validateDisputeInvoice = validateRequest(
  z.object({
    dispute_reason: z.string().min(10, 'Dispute reason must be at least 10 characters').max(2000),
  })
);

export const validatePaymentHistoryQuery = validateQuery(
  z.object({
    limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
    offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0)).optional(),
  })
);

export const validateRegionParam = validateParams(
  z.object({
    region: z.string().min(1, 'Region is required'),
  })
);

export const validateInvoiceAnalytics = validateQuery(
  z.object({
    region: z.string().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
  })
);

export const validateGenerateMonthlyInvoices = validateRequest(
  z.object({
    year: z.number().int().min(2020).max(2100),
    month: z.number().int().min(1).max(12),
    region: z.string().optional(),
  })
);

export const validateExportInvoices = validateQuery(
  z.object({
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
    region: z.string().optional(),
    status: invoiceStatusSchema.optional(),
    format: z.enum(['csv', 'json']),
  })
);
