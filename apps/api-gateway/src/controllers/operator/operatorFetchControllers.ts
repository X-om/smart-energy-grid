import { Request, Response, NextFunction } from 'express';
import { postgresPool } from '../../utils/db.js';
import { PaginatedResponse } from '../../types/index.js';
import * as operatorService from '../../db/services/operatorPostgresService.js';

export const getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validation already done by middleware
    const { role, region, limit, offset } = req.query;

    const filters = {
      role: role as string | undefined,
      region: region as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    };

    const { users, total } = await operatorService.getAllUsers(postgresPool, filters);

    // Remove sensitive data
    const sanitizedUsers = users.map(({ password_hash, ...user }) => user);

    res.status(200).json({
      success: true,
      data: sanitizedUsers,
      pagination: {
        total,
        limit: filters.limit,
        offset: filters.offset,
      },
    } as PaginatedResponse<any>);
  } catch (error) {
    next(error);
  }
};

export const getUsersByRegion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validation already done by middleware
    const { region } = req.params;

    const users = await operatorService.getUsersByRegion(postgresPool, region);

    // Remove sensitive data
    const sanitizedUsers = users.map(({ password_hash, ...user }) => user);

    res.status(200).json({
      success: true,
      data: sanitizedUsers,
    });
  } catch (error) {
    next(error);
  }
};
