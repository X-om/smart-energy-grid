import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';
import { verifyToken, generateAccessToken, decodeToken, getTokenExpiry } from '../../services/auth/jwt.service';
import { getSessionByRefreshToken, updateSessionAccessToken, invalidateSession, invalidateAllUserSessions } from '../../services/database/session.service';
import { blacklistToken } from '../../services/database/tokenBlacklist.service';
import { getUserById } from '../../services/database/user.service';
import { UnauthorizedError, TokenInvalidError } from '../../utils/errors';

// * POST /api/v1/auth/refresh-token
export const refreshTokenController = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { refreshToken } = req.body;
    const payload = verifyToken(refreshToken);

    if (payload.type !== 'refresh') throw new TokenInvalidError('Invalid token type');
    const session = await getSessionByRefreshToken(refreshToken);

    if (!session) throw new UnauthorizedError('Session not found');
    if (!session.is_valid) throw new UnauthorizedError('Session has been invalidated');
    if (new Date() > session.expires_at) throw new UnauthorizedError('Session has expired');

    const user = await getUserById(session.user_id);
    if (!user) throw new UnauthorizedError('User not found');
    if (!user.is_active) throw new UnauthorizedError('Account has been suspended');

    const newAccessToken = generateAccessToken(user.user_id, user.email, user.role);
    const newPayload = decodeToken(newAccessToken);

    if (newPayload?.jti) await updateSessionAccessToken(session.session_id, newPayload.jti);
    successResponse(res, 200, 'Token refreshed successfully', {
      accessToken: newAccessToken, expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m'
    });
  });

// * POST /api/v1/auth/logout
export const logoutController = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const accessTokenJti = req.user!.jti;
    const { refreshToken } = req.body || {};

    if (accessTokenJti) {
      const expiry = getTokenExpiry(req.headers.authorization?.split(' ')[1] || '');
      if (expiry) await blacklistToken(accessTokenJti, 'access', new Date(expiry), userId, 'logout');
    }

    if (refreshToken) {
      try {
        const session = await getSessionByRefreshToken(refreshToken);
        if (session && session.user_id === userId) {
          await invalidateSession(session.session_id);
          const refreshPayload = decodeToken(refreshToken);

          if (refreshPayload?.jti) {
            const expiry = getTokenExpiry(refreshToken);
            if (expiry)
              await blacklistToken(refreshPayload.jti, 'refresh', new Date(expiry), userId, 'logout');
          }
        }
      } catch {/* Silently fail if session not found */ }
    }

    successResponse(res, 200, 'Logged out successfully', {
      message: 'You have been logged out successfully',
    });
  }
);

// * POST /api/v1/auth/logout-all
export const logoutAllController = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const invalidatedCount = await invalidateAllUserSessions(userId);

    // Note: In production, you might want to also blacklist all existing tokens
    // This requires fetching all sessions and their JTIs first

    successResponse(res, 200, 'Logged out from all devices', {
      message: `Successfully logged out from ${invalidatedCount} device(s)`, invalidatedSessions: invalidatedCount
    });
  }
);
