import { Request, Response, NextFunction } from 'express';
import { postgresPool } from '../../utils/db.js';
import { ApiResponse } from '../../types/index.js';
import * as adminService from '../../db/services/adminPostgresService.js';

export const assignMeter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validation already done by middleware
    const { userId, meterId, region } = req.body;

    await adminService.assignMeterToUser(postgresPool, userId, meterId, region);

    res.status(200).json({
      success: true,
      message: 'Meter assigned successfully',
    } as ApiResponse);
  } catch (error: any) {
    if (error.message === 'Meter already assigned to another user') {
      res.status(400).json({
        success: false,
        error: {
          code: 'METER_ALREADY_ASSIGNED',
          message: error.message,
        },
      } as ApiResponse);
      return;
    }
    next(error);
  }
};

export const changeUserRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validation already done by middleware
    const { userId } = req.params;
    const { role } = req.body;

    await adminService.changeUserRole(postgresPool, userId, role);

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
    } as ApiResponse);
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validation already done by middleware
    const { userId } = req.params;

    await adminService.deleteUser(postgresPool, userId);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    } as ApiResponse);
  } catch (error) {
    next(error);
  }
};
