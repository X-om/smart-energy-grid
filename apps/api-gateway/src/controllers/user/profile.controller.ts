import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { successResponse } from '../../utils/response.js';
import { getUserById, updateUser } from '../../services/database/user.service.js';
import { NotFoundError } from '../../utils/errors.js';

// * GET /api/v1/user/profile
export const getProfileController = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const user = await getUserById(userId);

    if (!user) throw new NotFoundError('User not found');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...userProfile } = user;

    successResponse(res, 200, 'Profile retrieved successfully', userProfile);
  }
);

// * PUT /api/v1/user/profile
export const updateProfileController = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const { name, phone, region } = req.body;

    const updatedUser = await updateUser(userId, { name, phone, region });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...userProfile } = updatedUser;

    successResponse(res, 200, 'Profile updated successfully', userProfile);
  }
);
