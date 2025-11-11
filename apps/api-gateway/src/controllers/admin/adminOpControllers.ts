import { Request, Response, NextFunction } from 'express';
import { successResponse, errorResponse } from '../../utils/response.js';
import * as userService from '../../services/database/user.service.js';
import { ConflictError } from '../../utils/errors.js';

export const assignMeter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, meterId } = req.body;

    await userService.assignMeterToUser(userId, meterId);
    successResponse(res, 200, 'Meter assigned successfully', null);
  } catch (error) {
    if (error instanceof ConflictError) {
      return errorResponse(res, 400, error.message, 'METER_ALREADY_ASSIGNED');
    }
    next(error);
  }
};

export const changeUserRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    await userService.changeUserRole(userId, role);
    successResponse(res, 200, 'User role updated successfully', null);
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;

    await userService.deleteUser(userId);
    successResponse(res, 200, 'User deleted successfully', null);
  } catch (error) {
    next(error);
  }
};
