import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse, createdResponse } from '../../utils/response';
import { createUser, getUserByEmail, verifyUserEmail } from '../../services/database/user.service';
import { createOTP, verifyOTP, resendOTP } from '../../services/auth/otp.service';
import { ConflictError, BadRequestError } from '../../utils/errors';

// * POST /api/v1/auth/register
export const registerController = asyncHandler(

  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { name, email, phone, region } = req.body;
    const existingUser = await getUserByEmail(email);

    if (existingUser)
      throw new ConflictError('User with this email already exists');

    const user = await createUser({ name, email, phone, region, role: 'user' });
    const otp = await createOTP(email, 'email_verification');

    // TODO: Send OTP via email (when email service is implemented)
    // For now, we'll return it in the response (development only)
    const responseData = {
      user: { user_id: user.user_id, email: user.email, name: user.name, email_verified: user.email_verified, },
      message: 'Registration successful. Please verify your email with the OTP sent.',
      ...(process.env.NODE_ENV === 'development' && { otp }), // Only in development
    };
    createdResponse(res, 'User registered successfully', responseData);
  }
);


// * POST /api/v1/auth/verify-otp
export const verifyOTPController = asyncHandler(
  
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { email, otp } = req.body;

    await verifyOTP(email, otp, 'email_verification');
    await verifyUserEmail(email);

    const user = await getUserByEmail(email);
    if (!user) throw new BadRequestError('User not found');

    successResponse(res, 200, 'Email verified successfully', {
      user: { user_id: user.user_id, email: user.email, name: user.name, email_verified: user.email_verified },
      next_step: 'Please set your password using /auth/set-password'
    });
  }
);

// * POST /api/v1/auth/resend-otp
export const resendOTPController = asyncHandler(

  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { email, purpose = 'email_verification' } = req.body;

    const user = await getUserByEmail(email);
    if (!user) throw new BadRequestError('User not found');

    const otp = await resendOTP(email, purpose);

    // TODO: Send OTP via email
    const responseData = {
      message: 'OTP sent successfully',
      ...(process.env.NODE_ENV === 'development' && { otp })
    };

    successResponse(res, 200, 'OTP sent successfully', responseData);
  }

);
