import { Request, Response, NextFunction } from 'express';
import { getUsersQuerySchema, regionParamSchema } from '../../schemas/zodSchemas.js';

export const getAllUsersInputValidation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const result = getUsersQuerySchema.safeParse(req.query);
  if (!result.success) {
    return void res.status(403).json({
      success: false,
      error: {
        message: result.error.issues,
      },
    });
  }
  req.query = result.data as any;
  return next();
};

export const getUsersByRegionInputValidation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const result = regionParamSchema.safeParse(req.params);
  if (!result.success) {
    return void res.status(403).json({
      success: false,
      error: {
        message: result.error.issues,
      },
    });
  }
  req.params = result.data;
  return next();
};
