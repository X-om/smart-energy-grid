import { JWTPayload } from '../services/auth/jwt.service.js';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export { };
