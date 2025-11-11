import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { successResponse } from '../../utils/response.js';
import { getUserByEmail, updateLastLogin } from '../../services/database/user.service.js';
import { verifyPassword } from '../../services/auth/password.service.js';
import { generateTokenPair } from '../../services/auth/jwt.service.js';
import { createSession } from '../../services/database/session.service.js';
import { UnauthorizedError } from '../../utils/errors.js';

// * POST /api/v1/auth/login
export const loginController = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { email, password } = req.body;
    const user = await getUserByEmail(email);

    if (!user) throw new UnauthorizedError('Invalid email or password');
    if (!user.email_verified) throw new UnauthorizedError('Please verify your email before logging in');
    if (!user.password_hash) throw new UnauthorizedError('Please set your password first using /auth/set-password');
    if (!user.is_active) throw new UnauthorizedError(`Account suspended: ${user.suspended_reason || 'Contact administrator'}`);

    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) throw new UnauthorizedError('Invalid email or password');

    const tokens = generateTokenPair(user.user_id, user.email, user.role);
    await createSession({
      userId: user.user_id, refreshToken: tokens.refreshToken,
      ipAddress: req.ip, userAgent: req.get('user-agent'),
    });

    await updateLastLogin(user.user_id);
    successResponse(res, 200, 'Login successful', {
      user: {
        user_id: user.user_id, email: user.email,
        name: user.name, role: user.role,
        meter_id: user.meter_id, region: user.region
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn
      },
    });
  }
);
