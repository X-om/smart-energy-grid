import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { TokenExpiredError, TokenInvalidError } from '../../utils/errors';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
  jti?: string;
  exp?: number;
  iat?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

// * Generate JWT ID (unique identifier for token)
const generateJTI = (): string => `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

// * Generate access token
export const generateAccessToken = (userId: string, email: string, role: string): string => {
  const jti = generateJTI();
  const payload: JWTPayload = { userId, email, role, type: 'access', jti };
  const options: jwt.SignOptions = { expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'], };

  return jwt.sign(payload, env.JWT_SECRET, options);
};

// * Generate refresh token
export const generateRefreshToken = (userId: string, email: string, role: string): string => {
  const jti = generateJTI();
  const payload: JWTPayload = { userId, email, role, type: 'refresh', jti };
  const options: jwt.SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRY as jwt.SignOptions['expiresIn'], };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

// * Generate both access and refresh tokens
export const generateTokenPair = (userId: string, email: string, role: string): TokenPair => ({
  accessToken: generateAccessToken(userId, email, role),
  refreshToken: generateRefreshToken(userId, email, role),
  expiresIn: env.JWT_ACCESS_EXPIRY,
});

// * Verify JWT token
export const verifyToken = (token: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) throw new TokenExpiredError('Token has expired');
    else if (error instanceof jwt.JsonWebTokenError) throw new TokenInvalidError('Invalid token');
    else throw new TokenInvalidError('Token verification failed');
  }
}

// * Decode token without verification (for debugging)
export const decodeToken = (token: string): JWTPayload | null => {
  try { return jwt.decode(token) as JWTPayload; } catch { return null; }
};

// * Extract token from Authorization header
export const extractTokenFromHeader = (authHeader?: string): string | null => {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
};

// * Get token expiry time in milliseconds
export const getTokenExpiry = (token: string): number | null => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp)
    return null;

  return decoded.exp * 1000;
};

// * Check if token is expired
export const isTokenExpired = (token: string): boolean => {
  const expiry = getTokenExpiry(token);
  if (!expiry) return true;

  return Date.now() >= expiry;
};
