-- Migration 007: Create User Preferences Table
-- User notification settings and UI preferences

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    
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
    high_consumption_threshold_kwh NUMERIC(10, 2) DEFAULT 100,
    
    -- Dashboard Preferences
    default_chart_resolution VARCHAR(10) DEFAULT '15m' 
                             CHECK (default_chart_resolution IN ('1m', '15m', '1h', '1d')),
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to create default preferences for new users
CREATE OR REPLACE FUNCTION create_default_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_preferences (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create preferences on user creation
DROP TRIGGER IF EXISTS auto_create_preferences ON users;
CREATE TRIGGER auto_create_preferences
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_preferences();

-- Comments
COMMENT ON TABLE user_preferences IS 'User-specific notification and UI preferences';
COMMENT ON COLUMN user_preferences.high_consumption_threshold_kwh IS 'Custom threshold for high consumption alerts';
COMMENT ON COLUMN user_preferences.default_chart_resolution IS 'Preferred time resolution for consumption charts';
COMMENT ON FUNCTION create_default_preferences IS 'Automatically create default preferences for new users';

