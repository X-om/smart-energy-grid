import jwt from 'jsonwebtoken';
import { authLogger as logger } from '../utils/logger.js';

export interface TokenPayload {
  userId: string;
  role: 'user' | 'operator' | 'admin';
  region?: string;
  meterId?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedClient extends TokenPayload {
  clientId: string;
  connectedAt: Date;
}

class AuthService {
  private jwtSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'mysecretkey';

    if (this.jwtSecret === 'mysecretkey') {
      logger.warn('Using default JWT secret - not secure for production!');
    }
  }

  /**
   * Verify JWT token and return decoded payload
   */
  verifyToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as TokenPayload;

      logger.debug('Token verified successfully', {
        userId: decoded.userId,
        role: decoded.role,
        region: decoded.region
      });

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.warn('Token verification failed: expired', { error: error.message });
        throw new Error('TOKEN_EXPIRED');
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('Token verification failed: invalid', { error: error.message });
        throw new Error('TOKEN_INVALID');
      } else {
        logger.error('Token verification failed: unknown error', error);
        throw new Error('TOKEN_VERIFICATION_FAILED');
      }
    }
  }

  /**
   * Generate JWT token (for testing purposes)
   */
  generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>, expiresIn: string = '24h'): string {
    try {
      const token = jwt.sign(payload as any, this.jwtSecret, { expiresIn } as any);

      logger.debug('Token generated', {
        userId: payload.userId,
        role: payload.role,
        expiresIn
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate token', error);
      throw error;
    }
  }

  /**
   * Extract token from query string or Authorization header
   */
  extractToken(url: string, authHeader?: string): string | null {
    // Try query parameter first
    const urlObj = new URL(url, 'ws://localhost');
    const tokenFromQuery = urlObj.searchParams.get('token');

    if (tokenFromQuery) {
      return tokenFromQuery;
    }

    // Try Authorization header
    if (authHeader) {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Check if user has permission for a channel
   */
  canAccessChannel(client: AuthenticatedClient, channel: string): boolean {
    // Admin can access everything
    if (client.role === 'admin') {
      return true;
    }

    // Operators can access all alerts and tariffs
    if (client.role === 'operator') {
      if (channel === 'alerts' || channel === 'tariffs') {
        return true;
      }
      // Operators can access any region
      if (channel.startsWith('region:')) {
        return true;
      }
    }

    // Users can access tariffs
    if (channel === 'tariffs') {
      return true;
    }

    // Users can access their own region
    if (channel.startsWith('region:') && client.region) {
      const channelRegion = channel.split(':')[1];
      return channelRegion === client.region;
    }

    // Users can access their own meter
    if (channel.startsWith('meter:') && client.meterId) {
      const channelMeter = channel.split(':')[1];
      return channelMeter === client.meterId;
    }

    // Users cannot access alerts by default
    if (channel === 'alerts') {
      return false;
    }

    return false;
  }

  /**
   * Get default channels for a client based on role
   */
  getDefaultChannels(client: AuthenticatedClient): string[] {
    const channels: string[] = [];

    if (client.role === 'admin' || client.role === 'operator') {
      channels.push('alerts', 'tariffs');
    } else {
      channels.push('tariffs');
    }

    if (client.region) {
      channels.push(`region:${client.region}`);
    }

    if (client.meterId) {
      channels.push(`meter:${client.meterId}`);
    }

    return channels;
  }
}

export const authService = new AuthService();
