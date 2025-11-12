#!/usr/bin/env node

/**
 * Seed Script: Bulk Assign Meters to Users
 * 
 * This script assigns meters to all users who don't have one assigned yet.
 * It automatically finds available meters from the simulator range (MTR-00000001 to MTR-10000000)
 * and assigns them to users based on their region.
 * 
 * Usage:
 *   node scripts/assign-meters-to-users.js
 *   
 * Or with pnpm:
 *   pnpm seed:meters
 */

import { pool } from '../src/utils/db';
import { bulkAssignMeters, getMeterAssignmentStats } from '../src/services/database/meter-assignment.service';

const logger = {
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  success: (msg: string, data?: any) => console.log(`[SUCCESS] ✅ ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  warn: (msg: string, data?: any) => console.warn(`[WARN] ⚠️  ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
};

async function main() {
  try {
    logger.info('Starting bulk meter assignment script...');

    // Get initial statistics
    logger.info('Fetching current meter assignment statistics...');
    const initialStats = await getMeterAssignmentStats();

    logger.info('Initial Statistics:', {
      total_users: initialStats.total_users,
      users_with_meters: initialStats.users_with_meters,
      users_without_meters: initialStats.users_without_meters,
      assignment_percentage: `${initialStats.assignment_percentage}%`,
    });

    if (initialStats.users_without_meters === 0) {
      logger.success('All users already have meters assigned!');
      process.exit(0);
    }

    logger.info(`Found ${initialStats.users_without_meters} users without meters. Starting assignment...`);

    // Perform bulk assignment
    const result = await bulkAssignMeters();

    logger.info('Bulk Assignment Results:', {
      success: result.success,
      failed: result.failed,
      total_processed: result.success + result.failed,
    });

    // Display successful assignments
    if (result.success > 0) {
      logger.success(`Successfully assigned meters to ${result.success} users:`);
      result.results
        .filter(r => !r.error)
        .forEach((r, idx) => {
          console.log(`  ${idx + 1}. ${r.email} → ${r.meterId} (${r.region})`);
        });
    }

    // Display failed assignments
    if (result.failed > 0) {
      logger.warn(`Failed to assign meters to ${result.failed} users:`);
      result.results
        .filter(r => r.error)
        .forEach((r, idx) => {
          console.log(`  ${idx + 1}. ${r.email} → Error: ${r.error}`);
        });
    }

    // Get final statistics
    logger.info('Fetching final meter assignment statistics...');
    const finalStats = await getMeterAssignmentStats();

    logger.success('Final Statistics:', {
      total_users: finalStats.total_users,
      users_with_meters: finalStats.users_with_meters,
      users_without_meters: finalStats.users_without_meters,
      assignment_percentage: `${finalStats.assignment_percentage}%`,
    });

    logger.info('Meters by Region:');
    finalStats.meters_by_region.forEach(r => {
      console.log(`  - ${r.region}: ${r.count} meters`);
    });

    logger.success('Bulk meter assignment completed successfully!');

  } catch (error) {
    logger.error('Failed to assign meters:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
