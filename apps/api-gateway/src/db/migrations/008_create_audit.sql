-- Migration 008: Create Audit Logs Table
-- Comprehensive audit trail for security and compliance

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failure', 'error')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);

-- Partitioning by month for better performance (optional, for production)
-- CREATE TABLE audit_logs_y2025m11 PARTITION OF audit_logs
-- FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
    p_user_id UUID,
    p_action VARCHAR(100),
    p_entity_type VARCHAR(50) DEFAULT NULL,
    p_entity_id VARCHAR(100) DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_status VARCHAR(20) DEFAULT 'success',
    p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id_var UUID;
BEGIN
    INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id, 
        old_values, new_values, ip_address, user_agent,
        status, error_message
    ) VALUES (
        p_user_id, p_action, p_entity_type, p_entity_id,
        p_old_values, p_new_values, p_ip_address, p_user_agent,
        p_status, p_error_message
    )
    RETURNING audit_logs.log_id INTO log_id_var;
    
    RETURN log_id_var;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for old audit logs (keep last 2 years)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM audit_logs 
    WHERE created_at < NOW() - INTERVAL '2 years';
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all system actions';
COMMENT ON COLUMN audit_logs.action IS 'Action performed (e.g., user.login, admin.delete_user)';
COMMENT ON COLUMN audit_logs.entity_type IS 'Type of entity affected (e.g., user, meter, invoice)';
COMMENT ON COLUMN audit_logs.old_values IS 'State before the action (for updates/deletes)';
COMMENT ON COLUMN audit_logs.new_values IS 'State after the action (for creates/updates)';
COMMENT ON FUNCTION log_audit_event IS 'Helper function to create audit log entries';
COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Remove audit logs older than 2 years';

