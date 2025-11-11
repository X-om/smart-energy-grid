-- Migration 006: Create Billing and Payment Tables
-- Invoice generation and payment tracking

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    invoice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    meter_id VARCHAR(50) NOT NULL REFERENCES meters(meter_id),
    region VARCHAR(50) NOT NULL,
    
    -- Billing Period
    billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Consumption Data
    total_consumption_kwh NUMERIC(10, 2) NOT NULL,
    peak_consumption_kwh NUMERIC(10, 2),
    off_peak_consumption_kwh NUMERIC(10, 2),
    
    -- Pricing
    avg_tariff_rate NUMERIC(10, 4) NOT NULL,
    base_cost NUMERIC(10, 2) NOT NULL,
    tax_amount NUMERIC(10, 2) DEFAULT 0,
    surcharges NUMERIC(10, 2) DEFAULT 0,
    discounts NUMERIC(10, 2) DEFAULT 0,
    total_cost NUMERIC(10, 2) NOT NULL,
    
    -- Payment Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
           CHECK (status IN ('pending', 'paid', 'overdue', 'disputed', 'cancelled')),
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),
    
    -- Dispute Management
    is_disputed BOOLEAN DEFAULT FALSE,
    disputed_at TIMESTAMP WITH TIME ZONE,
    dispute_reason TEXT,
    dispute_resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional Info
    pdf_url TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_meter_id ON invoices(meter_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_billing_period ON invoices(billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);

-- Payment transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    amount NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_gateway VARCHAR(50),
    gateway_transaction_id VARCHAR(100),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for payment transactions
CREATE INDEX IF NOT EXISTS idx_payment_transactions_invoice_id ON payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at DESC);

-- Create trigger for invoices updated_at
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
    year_month TEXT;
    sequence_num INT;
    invoice_num TEXT;
BEGIN
    year_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
    
    SELECT COUNT(*) + 1 INTO sequence_num
    FROM invoices
    WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE);
    
    invoice_num := 'INV-' || year_month || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE invoices IS 'Monthly billing invoices for users';
COMMENT ON TABLE payment_transactions IS 'Payment transaction records';
COMMENT ON COLUMN invoices.invoice_number IS 'Human-readable invoice number (e.g., INV-2025-11-0001)';
COMMENT ON COLUMN invoices.avg_tariff_rate IS 'Average tariff rate during the billing period';
COMMENT ON FUNCTION generate_invoice_number IS 'Generate sequential invoice number for current month';

