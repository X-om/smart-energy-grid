"use strict";
/**
 * Billing and invoice models.
 * Used by billing service and API gateway for user invoices.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isInvoice = isInvoice;
exports.isInvoiceItem = isInvoiceItem;
/**
 * Type guard to check if an object is a valid Invoice
 */
function isInvoice(obj) {
    const invoice = obj;
    return (typeof invoice === 'object' &&
        invoice !== null &&
        typeof invoice.invoiceId === 'string' &&
        typeof invoice.userId === 'string' &&
        typeof invoice.totalEnergyKwh === 'number' &&
        typeof invoice.totalCost === 'number' &&
        Array.isArray(invoice.items));
}
/**
 * Type guard to check if an object is a valid InvoiceItem
 */
function isInvoiceItem(obj) {
    const item = obj;
    return (typeof item === 'object' &&
        item !== null &&
        typeof item.startTime === 'string' &&
        typeof item.endTime === 'string' &&
        typeof item.energyKwh === 'number' &&
        typeof item.pricePerKwh === 'number' &&
        typeof item.cost === 'number');
}
//# sourceMappingURL=billing.js.map