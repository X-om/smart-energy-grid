import { Request, Response, NextFunction } from 'express';
import { postgresPool } from '../../utils/db.js';
import { ApiResponse } from '../../types/index.js';
import * as userService from '../../db/services/userPostgresService.js';

export const getUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.params.userId;

    const user = await userService.findUserById(postgresPool, userId);

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      } as ApiResponse);
      return;
    }

    // Remove sensitive data
    const { password_hash, ...userProfile } = user;

    res.status(200).json({
      success: true,
      data: userProfile,
    } as ApiResponse<typeof userProfile>);
  } catch (error) {
    next(error);
  }
};
