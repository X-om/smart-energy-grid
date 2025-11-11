// * Password Management Controllers
// * Handles password setting, changing, and reset

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { successResponse } from '../../utils/response.js';
import { getUserByEmail, setUserPassword, getUserById } from '../../services/database/user.service.js';
import { hashPassword, verifyPassword } from '../../services/auth/password.service.js';
import { createOTP, verifyOTP } from '../../services/auth/otp.service.js';
import { invalidateAllUserSessions } from '../../services/database/session.service.js';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../../utils/errors.js';

// * POST /api/v1/auth/set-password
export const setPasswordController = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {

    const { email, password } = req.body;
    const user = await getUserByEmail(email);

    if (!user) throw new NotFoundError('User not found');
    if (!user.email_verified) throw new BadRequestError('Please verify your email first');
    if (user.password_hash) throw new BadRequestError('Password already set. Use /auth/change-password to update it');

    const passwordHash = await hashPassword(password);
    await setUserPassword(user.user_id, passwordHash);

    successResponse(res, 200, 'Password set successfully', {
      message: 'You can now login with your email and password',
    });
  }
);

// * POST /api/v1/auth/change-password
export const changePasswordController = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.userId;

    const user = await getUserById(userId);
    if (!user) throw new NotFoundError('User not found');

    if (!user.password_hash) throw new BadRequestError('No password set. Use /auth/set-password first');
    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password_hash);

    if (!isCurrentPasswordValid) throw new UnauthorizedError('Current password is incorrect');
    const newPasswordHash = await hashPassword(newPassword);

    await setUserPassword(userId, newPasswordHash);
    await invalidateAllUserSessions(userId);

    successResponse(res, 200, 'Password changed successfully', {
      message: 'All sessions have been invalidated. Please login again with your new password'
    });
  }
);

// * POST /api/v1/auth/forgot-password
export const forgotPasswordController = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { email } = req.body;
    const user = await getUserByEmail(email);

    if (!user) return void successResponse(res, 200, 'If the email exists, a reset code has been sent',
      { message: 'Please check your email for the password reset code' });

    const otp = await createOTP(email, 'password_reset');
    // TODO: Send OTP via email

    const responseData = { message: 'Password reset code sent to your email', ...(process.env.NODE_ENV === 'development' && { otp }) };
    successResponse(res, 200, 'Password reset code sent', responseData);
  }
);

// * POST / api / v1 / auth / reset - password
export const resetPasswordController = asyncHandler(

  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { email, otp, newPassword } = req.body;

    await verifyOTP(email, otp, 'password_reset');
    const user = await getUserByEmail(email);

    if (!user) throw new NotFoundError('User not found');
    const newPasswordHash = await hashPassword(newPassword);

    await setUserPassword(user.user_id, newPasswordHash);
    await invalidateAllUserSessions(user.user_id);

    successResponse(res, 200, 'Password reset successfully', {
      message: 'Your password has been reset. Please login with your new password',
    });
  }
);
