import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../utils/errors.js';

type Role = 'user' | 'operator' | 'admin';

// * Authorize middleware factory - checks if user has required role
export const authorize = (...allowedRoles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user)
        throw new UnauthorizedError('Authentication required');
      if (!allowedRoles.includes(req.user.role as Role))
        throw new ForbiddenError(`Access denied. Required role: ${allowedRoles.join(' or ')}`);

      next();
    } catch (error) { next(error); }
  };

// * Check if user is admin
export const isAdmin = authorize('admin');

// * Check if user is operator or admin
export const isOperatorOrAdmin = authorize('operator', 'admin');

// * Check if user is accessing their own resource
export const isSelfOrAdmin = (getUserIdFromRequest: (req: Request) => string) => (req: Request, _res: Response, next: NextFunction): void => {
  try {
    if (!req.user) throw new UnauthorizedError('Authentication required');

    const targetUserId = getUserIdFromRequest(req);
    const isSelf = req.user.userId === targetUserId;
    const isAdminUser = req.user.role === 'admin';

    if (!isSelf && !isAdminUser) throw new ForbiddenError('You can only access your own resources');
    next();
  } catch (error) { next(error); }
};
