import { Request, Response, NextFunction } from 'express';
import { paginatedResponse } from '../../utils/response';
import * as userService from '../../services/database/user.service';

export const getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { role, region, limit = '50', offset = '0' } = req.query;

    const filters = {
      role: role as string | undefined,
      region: region as string | undefined,
      page: Math.floor(parseInt(offset as string, 10) / parseInt(limit as string, 10)) + 1,
      limit: parseInt(limit as string, 10),
    };

    const result = await userService.getUsers(filters);

    // Remove sensitive data
    const sanitizedUsers = result.users.map(({ password_hash, ...user }: any) => user);

    paginatedResponse(res, 200, 'Users retrieved successfully', sanitizedUsers, result.page, result.limit, result.total);
  } catch (error) {
    next(error);
  }
};

export const getUsersByRegion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { region } = req.params;

    const result = await userService.getUsers({ region });

    // Remove sensitive data
    const sanitizedUsers = result.users.map(({ password_hash, ...user }: any) => user);

    res.status(200).json({
      success: true,
      data: sanitizedUsers,
    });
  } catch (error) {
    next(error);
  }
};
