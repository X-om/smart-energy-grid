CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search optimization

-- Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate invoice numbers
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

-- Function to cleanup expired tokens and sessions
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM token_blacklist WHERE expires_at < NOW();
    DELETE FROM sessions WHERE expires_at < NOW();
    DELETE FROM otp_verifications WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- USERS & AUTHENTICATION
-- ==========================================

-- Users table - Core user accounts
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- Nullable: set after OTP verification
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL CHECK (role IN ('USER', 'OPERATOR', 'ADMIN')),
    region VARCHAR(100),
    meter_id VARCHAR(50) UNIQUE, -- Can be linked to meters table
    email_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    suspended_at TIMESTAMPTZ,
    suspended_reason TEXT,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_region ON users(region);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_meter_id ON users(meter_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE users IS 'User accounts for SEGS platform';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password - nullable during registration until OTP verified';
COMMENT ON COLUMN users.role IS 'USER (consumer), OPERATOR (utility staff), ADMIN (system admin)';

-- OTP Verifications table - Email verification codes
CREATE TABLE IF NOT EXISTS otp_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    purpose VARCHAR(50) DEFAULT 'email_verification' CHECK (purpose IN ('email_verification', 'password_reset', 'login_2fa')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    attempts INTEGER DEFAULT 0,
    verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_verifications(email);
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON otp_verifications(email, purpose);

COMMENT ON TABLE otp_verifications IS 'OTP codes for email verification, password reset, and 2FA';
COMMENT ON COLUMN otp_verifications.purpose IS 'email_verification (registration), password_reset, login_2fa';

-- Sessions table - JWT refresh token management
CREATE TABLE IF NOT EXISTS sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) NOT NULL UNIQUE,
    access_token_jti VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    is_valid BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_is_valid ON sessions(is_valid);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

COMMENT ON TABLE sessions IS 'Active user sessions with refresh tokens';
COMMENT ON COLUMN sessions.access_token_jti IS 'JWT ID of the associated access token for revocation';

-- Token Blacklist table - Revoked JWT tokens
CREATE TABLE IF NOT EXISTS token_blacklist (
    jti VARCHAR(100) PRIMARY KEY,
    token_type VARCHAR(20) NOT NULL CHECK (token_type IN ('access', 'refresh')),
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    blacklisted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_user_id ON token_blacklist(user_id);

COMMENT ON TABLE token_blacklist IS 'Revoked JWT tokens for logout and security';

-- User Preferences table - Notification and UI settings
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id VARCHAR(50) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    -- Notification Settings
    email_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT FALSE,
    push_notifications BOOLEAN DEFAULT TRUE,
    websocket_notifications BOOLEAN DEFAULT TRUE,
    -- Alert Preferences
    alert_high_consumption BOOLEAN DEFAULT TRUE,
    alert_zero_consumption BOOLEAN DEFAULT TRUE,
    alert_tariff_changes BOOLEAN DEFAULT TRUE,
    alert_billing_reminders BOOLEAN DEFAULT TRUE,
    high_consumption_threshold_kwh DECIMAL(10, 2) DEFAULT 100,
    -- Dashboard Preferences
    default_chart_resolution VARCHAR(10) DEFAULT '15m' 
                             CHECK (default_chart_resolution IN ('1m', '15m', '1h', '1d')),
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_preferences IS 'User-specific notification and UI preferences';

-- Auto-create preferences for new users
CREATE OR REPLACE FUNCTION create_default_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_preferences (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_create_preferences ON users;
CREATE TRIGGER auto_create_preferences
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_preferences();

-- METERS & DEVICES

CREATE TABLE IF NOT EXISTS meters (
    meter_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    region VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DECOMMISSIONED')),
    model VARCHAR(100),
    firmware_version VARCHAR(50),
    address TEXT,
    installed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_reading_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meters_user ON meters(user_id);
CREATE INDEX IF NOT EXISTS idx_meters_region ON meters(region);
CREATE INDEX IF NOT EXISTS idx_meters_status ON meters(status);
CREATE INDEX IF NOT EXISTS idx_meters_last_reading ON meters(last_reading_at DESC);

DROP TRIGGER IF EXISTS update_meters_updated_at ON meters;
CREATE TRIGGER update_meters_updated_at
    BEFORE UPDATE ON meters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE meters IS 'Smart meter devices installed at user locations';

-- TARIFFS & PRICING

CREATE TABLE IF NOT EXISTS tariffs (
    tariff_id VARCHAR(50) PRIMARY KEY,
    region VARCHAR(100) NOT NULL,
    time_of_day VARCHAR(20),  
    price_per_kwh DECIMAL(10, 4) NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    reason TEXT, 
    triggered_by VARCHAR(100),  
    created_by VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tariffs_region ON tariffs(region);
CREATE INDEX IF NOT EXISTS idx_tariffs_active ON tariffs(is_active, effective_from);
CREATE INDEX IF NOT EXISTS idx_tariffs_time ON tariffs(time_of_day);
CREATE INDEX IF NOT EXISTS idx_tariffs_region_effective ON tariffs(region, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_tariffs_triggered_by ON tariffs(triggered_by);

DROP TRIGGER IF EXISTS update_tariffs_updated_at ON tariffs;
CREATE TRIGGER update_tariffs_updated_at
    BEFORE UPDATE ON tariffs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE tariffs IS 'Electricity tariff pricing by region and time of day';
COMMENT ON COLUMN tariffs.time_of_day IS 'NULL for flat rate, or peak/off-peak/mid-peak for time-based pricing';

-- Tariff Rules table - Advanced pricing rules
CREATE TABLE IF NOT EXISTS tariff_rules (
    rule_id VARCHAR(50) PRIMARY KEY,
    region VARCHAR(100) NOT NULL,
    rule_type VARCHAR(50) NOT NULL, 
    conditions JSONB NOT NULL,
    base_price DECIMAL(10, 4) NOT NULL,
    multiplier DECIMAL(5, 2) DEFAULT 1.0,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tariff_rules_region ON tariff_rules(region);
CREATE INDEX IF NOT EXISTS idx_tariff_rules_type ON tariff_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_tariff_rules_active ON tariff_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_tariff_rules_priority ON tariff_rules(priority DESC);

DROP TRIGGER IF EXISTS update_tariff_rules_updated_at ON tariff_rules;
CREATE TRIGGER update_tariff_rules_updated_at
    BEFORE UPDATE ON tariff_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE tariff_rules IS 'Complex tariff calculation rules based on load, time, season';

-- ALERTS & NOTIFICATIONS

CREATE TABLE IF NOT EXISTS alerts (
    alert_id VARCHAR(50) PRIMARY KEY,
    meter_id VARCHAR(50),
    region VARCHAR(100),
    alert_type VARCHAR(50) NOT NULL, -- 'high-consumption', 'zero-consumption', 'anomaly', 'load-spike', etc.
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message TEXT NOT NULL,
    threshold_value DECIMAL(12, 4),
    actual_value DECIMAL(12, 4),
    metadata JSONB,
    -- Resolution tracking
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(50),
    -- Acknowledgement tracking
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerts_meter ON alerts(meter_id);
CREATE INDEX IF NOT EXISTS idx_alerts_region ON alerts(region);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_created_resolved ON alerts(created_at, is_resolved);

DROP TRIGGER IF EXISTS update_alerts_updated_at ON alerts;
CREATE TRIGGER update_alerts_updated_at
    BEFORE UPDATE ON alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE alerts IS 'System-generated alerts for consumption anomalies and grid events';
COMMENT ON COLUMN alerts.acknowledged IS 'Whether an operator has seen this alert';
COMMENT ON COLUMN alerts.is_resolved IS 'Whether the underlying issue has been fixed';

-- ==========================================
-- BILLING & INVOICING
-- ==========================================

CREATE TABLE IF NOT EXISTS invoices (
    invoice_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    meter_id VARCHAR(50) NOT NULL,
    region VARCHAR(50) NOT NULL,
    -- Billing Period
    billing_period_start TIMESTAMPTZ NOT NULL,
    billing_period_end TIMESTAMPTZ NOT NULL,
    -- Consumption Data
    total_consumption_kwh DECIMAL(10, 2) NOT NULL,
    peak_consumption_kwh DECIMAL(10, 2),
    off_peak_consumption_kwh DECIMAL(10, 2),
    -- Pricing
    avg_tariff_rate DECIMAL(10, 4) NOT NULL,
    base_cost DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    surcharges DECIMAL(10, 2) DEFAULT 0,
    discounts DECIMAL(10, 2) DEFAULT 0,
    total_cost DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    -- Payment Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
           CHECK (status IN ('pending', 'paid', 'overdue', 'disputed', 'cancelled')),
    due_date TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),
    -- Dispute Management
    is_disputed BOOLEAN DEFAULT FALSE,
    disputed_at TIMESTAMPTZ,
    dispute_reason TEXT,
    dispute_resolved_at TIMESTAMPTZ,
    -- Additional Info
    pdf_url TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_meter ON invoices(meter_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE invoices IS 'Monthly billing invoices for energy consumption';

-- Invoice Line Items table
CREATE TABLE IF NOT EXISTS invoice_line_items (
    line_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    description TEXT,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    kwh_consumed DECIMAL(12, 2) NOT NULL,
    rate_per_kwh DECIMAL(10, 4) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_line_items_invoice ON invoice_line_items(invoice_id);

COMMENT ON TABLE invoice_line_items IS 'Detailed breakdown of invoice charges by time period';

-- Payment Transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id),
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_gateway VARCHAR(50),
    gateway_transaction_id VARCHAR(100),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_invoice_id ON payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at DESC);

COMMENT ON TABLE payment_transactions IS 'Payment transaction records for invoices';

-- AUDIT & LOGGING

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(50),
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

COMMENT ON TABLE audit_logs IS 'Audit trail for all system operations and user actions';

 
-- GRANT PERMISSIONS

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO segs_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO segs_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO segs_user;

-- SUCCESS MESSAGE

DO $$
BEGIN
    RAISE NOTICE '✅ PostgreSQL database initialized successfully!';
    RAISE NOTICE '📊 Tables created:';
    RAISE NOTICE '   - Authentication: users, otp_verifications, sessions, token_blacklist, user_preferences';
    RAISE NOTICE '   - Devices: meters';
    RAISE NOTICE '   - Pricing: tariffs, tariff_rules';
    RAISE NOTICE '   - Alerts: alerts';
    RAISE NOTICE '   - Billing: invoices, invoice_line_items, payment_transactions';
    RAISE NOTICE '   - Audit: audit_logs';
    RAISE NOTICE '🔧 Utility functions: update_updated_at_column, generate_invoice_number, cleanup_expired_tokens';
    RAISE NOTICE '⚡ All triggers and indexes created';
END $$;
