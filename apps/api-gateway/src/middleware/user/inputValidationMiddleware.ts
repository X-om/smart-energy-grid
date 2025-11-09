import { Request, Response, NextFunction } from 'express';
import { registerSchema, verifyOTPSchema } from '../../schemas/zodSchemas.js';

export const registerInputValidation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success)
    return void res.status(403).json({ success: false, error: { message: result.error.issues } });

  req.body = result.data;
  return next();
};

export const verifyOTPInputValidation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const result = verifyOTPSchema.safeParse(req.body);
  if (!result.success)
    return void res.status(403).json({ success: false, error: { message: result.error.issues } });

  req.body = result.data;
  return next();
};
