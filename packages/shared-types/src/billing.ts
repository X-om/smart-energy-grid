
export interface InvoiceItem {
  startTime: string;
  endTime: string;
  energyKwh: number;
  pricePerKwh: number;
  cost: number;
  description?: string;
}

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export interface Invoice {
  invoiceId: string;
  userId: string;
  meterId?: string;
  periodStart: string;
  periodEnd: string;
  totalEnergyKwh: number;
  totalCost: number;
  items: InvoiceItem[];
  createdAt: string;
  status?: InvoiceStatus;
  dueDate?: string;
  paidAt?: string;
  taxAmount?: number;
  currency?: string;
}

export interface BillingSummary {
  userId: string;
  periodStart: string;
  periodEnd: string;
  totalEnergyKwh: number;
  totalCost: number;
  avgDailyCost: number;
  invoiceCount: number;
  peakHour?: number;
  peakDay?: string;
}

export interface Payment {
  paymentId: string;
  invoiceId: string;
  userId: string;
  amount: number;
  method: string;

  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  createdAt: string;
  completedAt?: string;
  transactionRef?: string;
}
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
