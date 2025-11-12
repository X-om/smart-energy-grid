import { pool } from '../../utils/db';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';

interface MeterAssignmentResult {
  user_id: string;
  meter_id: string;
  region: string;
}

// * Get next available meter ID from simulator range that's not assigned to any user
export const getNextAvailableMeter = async (preferredRegion?: string): Promise<string> => {
  try {
    // Get all assigned meter IDs
    const assignedMetersQuery = `
      SELECT meter_id 
      FROM users 
      WHERE meter_id IS NOT NULL
      ORDER BY meter_id
    `;
    const assignedResult = await pool.query(assignedMetersQuery);
    const assignedMeters = new Set(assignedResult.rows.map(row => row.meter_id));

    // Simulator generates meters from MTR-00000001 to MTR-00000100 (configurable)
    // Find the first unassigned meter
    for (let i = 1; i <= 10000; i++) {
      const meterId = `MTR-${String(i).padStart(8, '0')}`;
      if (!assignedMeters.has(meterId)) {
        logger.info({ meterId, preferredRegion }, 'Found available meter');
        return meterId;
      }
    }

    throw new Error('No available meters in the simulator range');
  } catch (error) {
    logger.error({ error, preferredRegion }, 'Error finding available meter');
    throw error;
  }
};

// * Assign meter to user with region validation
export const assignMeterToUser = async (
  userId: string,
  meterId?: string,
  region?: string
): Promise<MeterAssignmentResult> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get user details
    const userQuery = 'SELECT user_id, email, region, meter_id FROM users WHERE user_id = $1';
    const userResult = await client.query(userQuery, [userId]);

    if (userResult.rows.length === 0) throw new NotFoundError('User not found');

    const user = userResult.rows[0];

    // Check if user already has a meter
    if (user.meter_id) throw new ConflictError(`User already has meter ${user.meter_id} assigned`);

    // If meterId not provided, get next available meter
    const meterToAssign = meterId || await getNextAvailableMeter(region || user.region);

    // Check if meter is already assigned to another user
    const meterCheckQuery = 'SELECT user_id, email FROM users WHERE meter_id = $1 AND user_id != $2';
    const meterCheckResult = await client.query(meterCheckQuery, [meterToAssign, userId]);

    if (meterCheckResult.rows.length > 0) {
      const existingUser = meterCheckResult.rows[0];
      throw new ConflictError(`Meter ${meterToAssign} is already assigned to user ${existingUser.email}`);
    }

    // Update user with meter_id and region if provided
    const updateQuery = `
      UPDATE users 
      SET meter_id = $1, 
          region = COALESCE($2, region),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $3
      RETURNING user_id, meter_id, region
    `;
    const updateResult = await client.query(updateQuery, [meterToAssign, region, userId]);

    await client.query('COMMIT');

    logger.info({
      userId,
      email: user.email,
      meterId: meterToAssign,
      region: updateResult.rows[0].region,
    }, 'Meter assigned to user successfully');

    return updateResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ error, userId, meterId }, 'Error assigning meter to user');
    throw error;
  } finally {
    client.release();
  }
};

// * Bulk assign meters to users without meters
export const bulkAssignMeters = async (): Promise<{
  success: number;
  failed: number;
  results: Array<{ userId: string; email: string; meterId: string; region: string; error?: string }>;
}> => {
  try {
    // Get all users without meters
    const usersQuery = `
      SELECT user_id, email, region 
      FROM users 
      WHERE meter_id IS NULL 
      ORDER BY created_at ASC
    `;
    const usersResult = await pool.query(usersQuery);
    const usersWithoutMeters = usersResult.rows;

    logger.info({ count: usersWithoutMeters.length }, 'Found users without meters');

    const results: Array<{ userId: string; email: string; meterId: string; region: string; error?: string }> = [];
    let success = 0;
    let failed = 0;

    for (const user of usersWithoutMeters) {
      try {
        const result = await assignMeterToUser(user.user_id, undefined, user.region);
        results.push({
          userId: result.user_id,
          email: user.email,
          meterId: result.meter_id,
          region: result.region,
        });
        success++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          userId: user.user_id,
          email: user.email,
          meterId: 'N/A',
          region: user.region || 'N/A',
          error: errorMessage,
        });
        failed++;
        logger.error({ userId: user.user_id, email: user.email, error: errorMessage }, 'Failed to assign meter');
      }
    }

    logger.info({ success, failed, total: usersWithoutMeters.length }, 'Bulk meter assignment completed');

    return { success, failed, results };
  } catch (error) {
    logger.error({ error }, 'Error in bulk meter assignment');
    throw error;
  }
};

// * Unassign meter from user
export const unassignMeterFromUser = async (userId: string): Promise<void> => {
  try {
    const query = `
      UPDATE users 
      SET meter_id = NULL, 
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING user_id, email, meter_id
    `;
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) throw new NotFoundError('User not found');

    logger.info({ userId, email: result.rows[0].email }, 'Meter unassigned from user');
  } catch (error) {
    logger.error({ error, userId }, 'Error unassigning meter from user');
    throw error;
  }
};

// * Get meter assignment statistics
export const getMeterAssignmentStats = async (): Promise<{
  total_users: number;
  users_with_meters: number;
  users_without_meters: number;
  assignment_percentage: number;
  meters_by_region: Array<{ region: string; count: number }>;
}> => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(meter_id) as users_with_meters,
        COUNT(*) - COUNT(meter_id) as users_without_meters
      FROM users
    `;
    const statsResult = await pool.query(statsQuery);
    const stats = statsResult.rows[0];

    const regionQuery = `
      SELECT region, COUNT(*) as count
      FROM users
      WHERE meter_id IS NOT NULL AND region IS NOT NULL
      GROUP BY region
      ORDER BY count DESC
    `;
    const regionResult = await pool.query(regionQuery);

    return {
      total_users: parseInt(stats.total_users),
      users_with_meters: parseInt(stats.users_with_meters),
      users_without_meters: parseInt(stats.users_without_meters),
      assignment_percentage: stats.total_users > 0
        ? parseFloat(((stats.users_with_meters / stats.total_users) * 100).toFixed(2))
        : 0,
      meters_by_region: regionResult.rows.map(row => ({
        region: row.region,
        count: parseInt(row.count),
      })),
    };
  } catch (error) {
    logger.error({ error }, 'Error getting meter assignment statistics');
    throw error;
  }
};
