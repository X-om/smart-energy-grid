export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'disputed' | 'cancelled';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export interface Invoice {
  invoice_id: string;
  invoice_number: string;
  user_id: string;
  meter_id: string;
  region: string;
  billing_period_start: Date;
  billing_period_end: Date;
  total_consumption_kwh: number;
  peak_consumption_kwh: number | null;
  off_peak_consumption_kwh: number | null;
  avg_tariff_rate: number;
  base_cost: number;
  tax_amount: number;
  surcharges: number;
  discounts: number;
  total_cost: number;
  currency: string;
  status: InvoiceStatus;
  due_date: Date;
  paid_at: Date | null;
  payment_method: string | null;
  payment_reference: string | null;
  is_disputed: boolean;
  disputed_at: Date | null;
  dispute_reason: string | null;
  dispute_resolved_at: Date | null;
  pdf_url: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface InvoiceLineItem {
  line_item_id: string;
  invoice_id: string;
  description: string;
  period_start: Date;
  period_end: Date;
  kwh_consumed: number;
  rate_per_kwh: number;
  amount: number;
  created_at: Date;
}

export interface PaymentTransaction {
  transaction_id: string;
  invoice_id: string;
  user_id: string;
  amount: number;
  payment_method: string;
  payment_gateway: string | null;
  gateway_transaction_id: string | null;
  status: PaymentStatus;
  failure_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface InvoiceWithLineItems extends Invoice {
  line_items: InvoiceLineItem[];
}

export interface InvoiceSummary {
  invoice_id: string;
  invoice_number: string;
  billing_period_start: Date;
  billing_period_end: Date;
  total_consumption_kwh: number;
  total_cost: number;
  currency: string;
  status: InvoiceStatus;
  due_date: Date;
  is_disputed: boolean;
  created_at: Date;
}

export interface BillingCycle {
  cycle_start: Date;
  cycle_end: Date;
  days_remaining: number;
  estimated_consumption_kwh: number;
  estimated_cost: number;
  current_month_invoice: Invoice | null;
}

export interface EstimatedBill {
  period_start: Date;
  period_end: Date;
  days_elapsed: number;
  total_days: number;
  consumption_to_date_kwh: number;
  projected_consumption_kwh: number;
  avg_tariff_rate: number;
  estimated_base_cost: number;
  estimated_tax: number;
  estimated_total: number;
  currency: string;
  confidence_level: 'high' | 'medium' | 'low';
}

export interface PaymentHistoryRecord {
  transaction_id: string;
  invoice_id: string;
  invoice_number: string;
  amount: number;
  payment_method: string;
  status: PaymentStatus;
  created_at: Date;
}

export interface OverdueInvoice {
  invoice_id: string;
  invoice_number: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  meter_id: string;
  region: string;
  total_cost: number;
  currency: string;
  due_date: Date;
  days_overdue: number;
  created_at: Date;
}

export interface InvoiceAnalytics {
  region: string;
  period_start: Date;
  period_end: Date;
  total_invoices: number;
  paid_invoices: number;
  pending_invoices: number;
  overdue_invoices: number;
  disputed_invoices: number;
  total_revenue: number;
  collected_revenue: number;
  outstanding_revenue: number;
  average_bill_amount: number;
  total_consumption_kwh: number;
  currency: string;
}

export interface MarkInvoicePaidRequest {
  payment_method: string;
  payment_reference?: string;
  paid_at?: Date;
  notes?: string;
}

export interface DisputeInvoiceRequest {
  dispute_reason: string;
}

export interface GenerateMonthlyInvoicesRequest {
  year: number;
  month: number;
  region?: string;
}

export interface ExportInvoicesRequest {
  start_date?: string;
  end_date?: string;
  region?: string;
  status?: InvoiceStatus;
  format: 'csv' | 'json';
}
