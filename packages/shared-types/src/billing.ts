/**
 * Billing and invoice models.
 * Used by billing service and API gateway for user invoices.
 */

/**
 * Represents a single line item in an invoice.
 * Each item corresponds to a billing period with specific tariff.
 */
export interface InvoiceItem {
  /** ISO 8601 timestamp marking the start of this billing period */
  startTime: string;

  /** ISO 8601 timestamp marking the end of this billing period */
  endTime: string;

  /** Total energy consumed during this period in kilowatt-hours */
  energyKwh: number;

  /** Tariff rate applied for this period (price per kWh) */
  pricePerKwh: number;

  /** Calculated cost for this period (energyKwh * pricePerKwh) */
  cost: number;

  /** Optional description of the billing period (e.g., "Peak Hours") */
  description?: string;
}

/**
 * Invoice status in the billing workflow.
 */
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED';

/**
 * Represents a complete invoice for a billing period.
 */
export interface Invoice {
  /** Unique identifier for this invoice (UUID v4) */
  invoiceId: string;

  /** User ID to whom this invoice belongs */
  userId: string;

  /** Meter ID associated with this invoice */
  meterId?: string;

  /** ISO 8601 timestamp marking the start of the billing period */
  periodStart: string;

  /** ISO 8601 timestamp marking the end of the billing period */
  periodEnd: string;

  /** Total energy consumed in kilowatt-hours for the entire period */
  totalEnergyKwh: number;

  /** Total amount due in local currency */
  totalCost: number;

  /** Itemized breakdown of charges */
  items: InvoiceItem[];

  /** ISO 8601 timestamp when the invoice was generated */
  createdAt: string;

  /** Current status of the invoice */
  status?: InvoiceStatus;

  /** Optional due date for payment */
  dueDate?: string;

  /** Optional payment date */
  paidAt?: string;

  /** Optional tax amount */
  taxAmount?: number;

  /** Optional currency code (default: USD) */
  currency?: string;
}

/**
 * Billing summary for a user over a time period.
 */
export interface BillingSummary {
  /** User ID */
  userId: string;

  /** Start of summary period */
  periodStart: string;

  /** End of summary period */
  periodEnd: string;

  /** Total energy consumed */
  totalEnergyKwh: number;

  /** Total cost */
  totalCost: number;

  /** Average daily cost */
  avgDailyCost: number;

  /** Number of invoices in this period */
  invoiceCount: number;

  /** Peak consumption hour of day (0-23) */
  peakHour?: number;

  /** Peak consumption day */
  peakDay?: string;
}

/**
 * Payment record for an invoice.
 */
export interface Payment {
  /** Unique payment ID */
  paymentId: string;

  /** Invoice ID this payment is for */
  invoiceId: string;

  /** User ID who made the payment */
  userId: string;

  /** Amount paid */
  amount: number;

  /** Payment method (e.g., "credit_card", "bank_transfer") */
  method: string;

  /** Payment status */
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

  /** ISO 8601 timestamp when payment was initiated */
  createdAt: string;

  /** ISO 8601 timestamp when payment was completed */
  completedAt?: string;

  /** Optional transaction reference from payment provider */
  transactionRef?: string;
}

/**
 * Type guard to check if an object is a valid Invoice
 */
export function isInvoice(obj: unknown): obj is Invoice {
  const invoice = obj as Invoice;
  return (
    typeof invoice === 'object' &&
    invoice !== null &&
    typeof invoice.invoiceId === 'string' &&
    typeof invoice.userId === 'string' &&
    typeof invoice.totalEnergyKwh === 'number' &&
    typeof invoice.totalCost === 'number' &&
    Array.isArray(invoice.items)
  );
}

/**
 * Type guard to check if an object is a valid InvoiceItem
 */
export function isInvoiceItem(obj: unknown): obj is InvoiceItem {
  const item = obj as InvoiceItem;
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof item.startTime === 'string' &&
    typeof item.endTime === 'string' &&
    typeof item.energyKwh === 'number' &&
    typeof item.pricePerKwh === 'number' &&
    typeof item.cost === 'number'
  );
}
