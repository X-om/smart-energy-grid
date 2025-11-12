import { JWTPayload } from '../services/auth/jwt.service';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export { };
