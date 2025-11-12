import { pool } from '../../utils/db';
import { NotFoundError, DatabaseError } from '../../utils/errors';

export interface UserPreferences {
  user_id: string;
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  websocket_notifications: boolean;
  alert_high_consumption: boolean;
  alert_zero_consumption: boolean;
  alert_tariff_changes: boolean;
  alert_billing_reminders: boolean;
  high_consumption_threshold_kwh: number;
  default_chart_resolution: string;
  timezone: string;
  language: string;
  theme: string;
  created_at: Date;
  updated_at: Date;
}

export interface UpdatePreferencesInput {
  email_notifications?: boolean;
  sms_notifications?: boolean;
  push_notifications?: boolean;
  websocket_notifications?: boolean;
  alert_high_consumption?: boolean;
  alert_zero_consumption?: boolean;
  alert_tariff_changes?: boolean;
  alert_billing_reminders?: boolean;
  high_consumption_threshold_kwh?: number;
  default_chart_resolution?: string;
  timezone?: string;
  language?: string;
  theme?: string;
}

// * Get user preferences
export const getUserPreferences = async (userId: string): Promise<UserPreferences | null> => {
  const query = 'SELECT * FROM user_preferences WHERE user_id = $1';
  const result = await pool.query(query, [userId]);
  return result.rows[0] || null;
};

// * Update user preferences
export const updateUserPreferences = async (userId: string, input: UpdatePreferencesInput): Promise<UserPreferences> => {
  try {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    Object.entries(input).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount++}`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      const prefs = await getUserPreferences(userId);
      if (!prefs) throw new NotFoundError('User preferences not found');

      return prefs;
    }

    values.push(userId);
    const query = `
    UPDATE user_preferences 
    SET ${fields.join(', ')}, updated_at = NOW() WHERE user_id = $${paramCount}
    RETURNING *
  `;

    const result = await pool.query(query, values);
    if (result.rows.length === 0) throw new NotFoundError('User preferences not found');

    return result.rows[0];
  } catch (error: unknown) {
    throw new DatabaseError('Failed to update preferences', error);
  }
};

// * Create default preferences (usually triggered by database trigger)
export const createDefaultPreferences = async (userId: string): Promise<UserPreferences> => {
  try {
    const query = `
    INSERT INTO user_preferences (user_id)
    VALUES ($1)
    ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
    RETURNING *
  `;
    const result = await pool.query(query, [userId]);
    return result.rows[0];

  } catch (error: unknown) {
    throw new DatabaseError('Failed to create default preferences', error);
  }
};

// * Delete user preferences
export const deleteUserPreferences = async (userId: string): Promise<void> => {
  const query = 'DELETE FROM user_preferences WHERE user_id = $1';
  const result = await pool.query(query, [userId]);

  if (result.rowCount === 0)
    throw new NotFoundError('User preferences not found');
};
