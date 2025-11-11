import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../../services/auth/jwt.service.js';
import { isTokenBlacklisted } from '../../services/database/tokenBlacklist.service.js';
import { UnauthorizedError, TokenBlacklistedError } from '../../utils/errors.js';

// * Authenticate middleware - verifies JWT token
export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    if (!token) throw new UnauthorizedError('No token provided');

    const payload = verifyToken(token);
    if (payload.jti) {
      const blacklisted = await isTokenBlacklisted(payload.jti);
      if (blacklisted) throw new TokenBlacklistedError('Token has been revoked');
    }

    if (payload.type !== 'access') throw new UnauthorizedError('Invalid token type');
    req.user = payload;

    next();
  } catch (error) { next(error); }
};

// * Optional authentication - doesn't fail if no token provided
export const optionalAuthenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    if (token) {
      const payload = verifyToken(token);
      if (payload.jti) {
        const blacklisted = await isTokenBlacklisted(payload.jti);
        if (!blacklisted)
          req.user = payload;
      } else
        req.user = payload;
    }
    next();
  } catch (error) { next(); }
};
