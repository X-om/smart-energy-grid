import { NextFunction, Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth/authenticate';
import { authorize } from '../middleware/auth/authorize';
import { env } from '../config/env';
import { validateGetInvoices, validateInvoiceId, validateMarkInvoicePaid, validateDisputeInvoice, validatePaymentHistoryQuery, validateRegionParam, validateInvoiceAnalytics, validateGenerateMonthlyInvoices, validateExportInvoices } from '../middleware/validation/billing.validation';
import { getUserInvoices, getInvoiceDetails, downloadInvoicePDF, getCurrentCycle, getEstimatedBill, getPaymentHistory, markInvoiceAsPaid, disputeInvoice } from '../controllers/billing/user.controller';
import { getOverdueInvoices, getInvoiceAnalytics, generateMonthlyInvoices, exportInvoiceData } from '../controllers/billing/operator.controller';

const router: Router = Router();

const checkBillingEnabled = (req: Request, res: Response, next: NextFunction) => {
  if (!env.ENABLE_BILLING)
    return res.status(503).json({
      success: false,
      error: { message: 'Billing feature is currently disabled', code: 'BILLING_DISABLED' },
    });
  next();
};

router.use(checkBillingEnabled);

router.get('/invoices', authenticate, validateGetInvoices, getUserInvoices);
router.get('/invoices/:invoiceId', authenticate, validateInvoiceId, getInvoiceDetails);
router.get('/invoices/:invoiceId/pdf', authenticate, validateInvoiceId, downloadInvoicePDF);
router.get('/current-cycle', authenticate, getCurrentCycle);
router.get('/estimated', authenticate, getEstimatedBill);
router.get('/payment-history', authenticate, validatePaymentHistoryQuery, getPaymentHistory);

router.put('/invoices/:invoiceId/paid', authenticate, validateInvoiceId, validateMarkInvoicePaid, markInvoiceAsPaid);

router.post('/invoices/:invoiceId/dispute', authenticate, validateInvoiceId, validateDisputeInvoice, disputeInvoice);

router.get('/operator/overdue/:region', authenticate, authorize('operator', 'admin'), validateRegionParam, getOverdueInvoices);
router.get('/operator/analytics', authenticate, authorize('operator', 'admin'), validateInvoiceAnalytics, getInvoiceAnalytics);

router.post('/operator/generate-monthly', authenticate, authorize('operator', 'admin'), validateGenerateMonthlyInvoices, generateMonthlyInvoices);

router.get('/operator/export', authenticate, authorize('operator', 'admin'), validateExportInvoices, exportInvoiceData);

export default router;