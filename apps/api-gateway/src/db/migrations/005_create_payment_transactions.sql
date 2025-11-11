-- Create payment transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_gateway VARCHAR(50),
    gateway_transaction_id VARCHAR(100),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_transactions_invoice_id ON payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway_id ON payment_transactions(gateway_transaction_id);

-- Add foreign key constraints
ALTER TABLE payment_transactions 
ADD CONSTRAINT fk_payment_invoice 
FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE CASCADE;

ALTER TABLE payment_transactions 
ADD CONSTRAINT fk_payment_user 
FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

COMMENT ON TABLE payment_transactions IS 'Payment transaction records for invoices';
COMMENT ON COLUMN payment_transactions.gateway_transaction_id IS 'Transaction ID from payment gateway (Stripe, PayPal, etc.)';
COMMENT ON COLUMN payment_transactions.metadata IS 'Additional payment metadata in JSON format';
