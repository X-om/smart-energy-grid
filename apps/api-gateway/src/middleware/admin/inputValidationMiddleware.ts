import { Request, Response, NextFunction } from 'express';
import { assignMeterSchema, changeRoleSchema, userIdParamSchema } from '../../schemas/zodSchemas.js';

export const assignMeterInputValidation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const result = assignMeterSchema.safeParse(req.body);
  if (!result.success) {
    return void res.status(403).json({
      success: false,
      error: {
        message: result.error.issues,
      },
    });
  }
  req.body = result.data;
  return next();
};

export const changeRoleInputValidation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const bodyResult = changeRoleSchema.safeParse(req.body);
  const paramsResult = userIdParamSchema.safeParse(req.params);

  if (!bodyResult.success) {
    return void res.status(403).json({
      success: false,
      error: {
        message: bodyResult.error.issues,
      },
    });
  }

  if (!paramsResult.success) {
    return void res.status(403).json({
      success: false,
      error: {
        message: paramsResult.error.issues,
      },
    });
  }

  req.body = bodyResult.data;
  req.params = paramsResult.data;
  return next();
};

export const deleteUserInputValidation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const result = userIdParamSchema.safeParse(req.params);
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
