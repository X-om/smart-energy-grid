import { Request, Response, NextFunction } from 'express';
import { postgresPool } from '../../utils/db.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { ApiResponse } from '../../types/index.js';
import * as userService from '../../db/services/userPostgresService.js';
import { IRegisterResponseData } from '../../types/responseTypes.js';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email } = req.body;
    const existingUser = await userService.findUserByEmail(postgresPool, email);
    if (existingUser)
      return void res.status(400).json({ success: false, error: { code: 'USER_EXISTS', message: 'User with this email already exists' } } as ApiResponse);

    const user = await userService.createUser(postgresPool, name, email);
    const otp = env.MASTER_OTP;
    await userService.createOTP(postgresPool, email, otp, 10);

    logger.info(`User registered: ${email}`);
    const response: ApiResponse<IRegisterResponseData> = {
      success: true, data: { userId: user.user_id, email: user.email, name: user.name, emailVerified: user.email_verified },
      message: 'Registration successful. Please verify your email with OTP.',
    };

    if (env.NODE_ENV === 'development' && response.data)
      (response.data as IRegisterResponseData & { devOTP?: string }).devOTP = otp;

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

export const verifyOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, otp } = req.body;
    const user = await userService.findUserByEmail(postgresPool, email);

    if (!user)
      return void res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } } as ApiResponse);

    if (user.email_verified)
      return void res.status(400).json({ success: false, error: { code: 'ALREADY_VERIFIED', message: 'Email already verified' } } as ApiResponse);

    let isValid = false;

    if (otp === env.MASTER_OTP) isValid = true;
    else isValid = await userService.verifyOTP(postgresPool, email, otp);

    if (!isValid) return void res.status(400).json({ success: false, error: { code: 'INVALID_OTP', message: 'Invalid or expired OTP' } } as ApiResponse);
    await userService.verifyUserEmail(postgresPool, email);
    logger.info(`Email verified: ${email}`);

    return void res.status(200).json({
      success: true, data: { userId: user.user_id, email: user.email, emailVerified: true },
      message: 'Email verified successfully.',
    } as ApiResponse<{ userId: string; email: string; emailVerified: boolean }>);
  } catch (error) {
    next(error);
  }
};
