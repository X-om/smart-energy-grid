import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authLogger as logger } from '../utils/logger.js';
import { sendUnauthorized, sendForbidden } from '../utils/response.js';

/**
 * JWT payload interface
 */
export interface TokenPayload {
  userId: string;
  role: 'USER' | 'OPERATOR' | 'ADMIN';
  region?: string;
  meterId?: string;
  email?: string;
  name?: string;
}

/**
 * Extended Express Request with user info
 */
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

/**
 * Extract JWT token from Authorization header or query parameter
 */
function extractToken(req: Request): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check query parameter (for WebSocket upgrades or testing)
  if (req.query.token && typeof req.query.token === 'string') {
    return req.query.token;
  }

  return null;
}

/**
 * Verify JWT token and attach user to request
 */
export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    logger.warn('Authentication failed: No token provided', {
      path: req.path,
      method: req.method,
    });
    return sendUnauthorized(res, 'No authentication token provided');
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'mysecretkey';
    const decoded = jwt.verify(token, jwtSecret) as TokenPayload;

    req.user = decoded;

    logger.debug('Authentication successful', {
      userId: decoded.userId,
      role: decoded.role,
      path: req.path,
    });

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Authentication failed: Token expired', {
        path: req.path,
        method: req.method,
      });
      return sendUnauthorized(res, 'Token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Authentication failed: Invalid token', {
        path: req.path,
        method: req.method,
        error: (error as Error).message,
      });
      return sendUnauthorized(res, 'Invalid authentication token');
    } else {
      logger.error('Authentication failed: Unknown error', error);
      return sendUnauthorized(res, 'Authentication failed');
    }
  }
}

/**
 * Require specific role(s) - must be used after authenticate middleware
 */
export function requireRole(...allowedRoles: Array<'USER' | 'OPERATOR' | 'ADMIN'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      logger.error('Authorization check failed: No user attached to request');
      return sendUnauthorized(res, 'Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Authorization failed: Insufficient permissions', {
        userId: req.user.userId,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
      });
      return sendForbidden(res, 'Insufficient permissions for this resource');
    }

    logger.debug('Authorization successful', {
      userId: req.user.userId,
      role: req.user.role,
      path: req.path,
    });

    next();
  };
}

/**
 * Optional authentication - attaches user if token is valid, but doesn't reject if missing
 */
export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'mysecretkey';
    const decoded = jwt.verify(token, jwtSecret) as TokenPayload;
    req.user = decoded;

    logger.debug('Optional authentication successful', {
      userId: decoded.userId,
      role: decoded.role,
    });
  } catch (error) {
    logger.debug('Optional authentication failed, continuing without user', {
      error: (error as Error).message,
    });
  }

  next();
}
