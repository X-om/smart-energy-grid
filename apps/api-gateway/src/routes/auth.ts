import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { postgresClient } from '../db/postgres.js';
import { authLogger as logger } from '../utils/logger.js';
import { sendSuccess, sendError, sendUnauthorized } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import type { Router as RouterType } from 'express';

const router: RouterType = Router();

/**
 * User data structure
 */
interface User {
  user_id: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'USER' | 'OPERATOR' | 'ADMIN';
  region?: string;
  meter_id?: string;
  created_at: Date;
}

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     user:
 *                       type: object
 *       401:
 *         description: Invalid credentials
 */
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      logger.warn('Login attempt with missing credentials');
      return sendError(res, 'Email and password are required', 400);
    }

    try {
      // Fetch user from database
      const result = await postgresClient.query<User>(
        'SELECT * FROM users WHERE email = $1 LIMIT 1',
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        logger.warn('Login attempt for non-existent user', { email });
        return sendUnauthorized(res, 'Invalid email or password');
      }

      const user = result.rows[0];

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        logger.warn('Login attempt with invalid password', { 
          email,
          userId: user.user_id 
        });
        return sendUnauthorized(res, 'Invalid email or password');
      }

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET || 'mysecretkey';
      const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1d';

      const tokenPayload = {
        userId: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role,
        region: user.region,
        meterId: user.meter_id,
      };

      const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: jwtExpiresIn } as any);

      logger.info('User logged in successfully', {
        userId: user.user_id,
        email: user.email,
        role: user.role,
      });

      // Return token and user info
      sendSuccess(res, {
        token,
        user: {
          userId: user.user_id,
          name: user.name,
          email: user.email,
          role: user.role,
          region: user.region,
          meterId: user.meter_id,
        },
      });
    } catch (error) {
      logger.error('Login error', error);
      return sendError(res, 'Login failed', 500);
    }
  })
);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register new user (for testing)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [USER, OPERATOR, ADMIN]
 *               region:
 *                 type: string
 *               meterId:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created
 */
router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name, role = 'USER', region, meterId } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return sendError(res, 'Email, password, and name are required', 400);
    }

    // Validate role
    const validRoles = ['USER', 'OPERATOR', 'ADMIN'];
    if (!validRoles.includes(role)) {
      return sendError(res, 'Invalid role', 400);
    }

    try {
      // Check if user already exists
      const existing = await postgresClient.query(
        'SELECT user_id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existing.rows.length > 0) {
        return sendError(res, 'User with this email already exists', 409);
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Generate user ID
      const userId = `USR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Insert user
      const result = await postgresClient.query<User>(
        `INSERT INTO users (user_id, email, password_hash, name, role, region, meter_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING user_id, email, name, role, region, meter_id`,
        [userId, email.toLowerCase(), passwordHash, name, role, region || null, meterId || null]
      );

      const user = result.rows[0];

      logger.info('User registered successfully', {
        userId: user.user_id,
        email: user.email,
        role: user.role,
      });

      // Generate token for immediate login
      const jwtSecret = process.env.JWT_SECRET || 'mysecretkey';
      const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1d';

      const tokenPayload = {
        userId: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role,
        region: user.region,
        meterId: user.meter_id,
      };

      const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: jwtExpiresIn } as any);

      sendSuccess(
        res,
        {
          token,
          user: {
            userId: user.user_id,
            name: user.name,
            email: user.email,
            role: user.role,
            region: user.region,
            meterId: user.meter_id,
          },
        },
        'User registered successfully',
        201
      );
    } catch (error) {
      logger.error('Registration error', error);
      return sendError(res, 'Registration failed', 500);
    }
  })
);

/**
 * @swagger
 * /auth/token/generate:
 *   post:
 *     summary: Generate JWT token (for testing/development)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - role
 *             properties:
 *               userId:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [USER, OPERATOR, ADMIN]
 *               email:
 *                 type: string
 *               name:
 *                 type: string
 *               region:
 *                 type: string
 *               meterId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token generated
 */
router.post(
  '/token/generate',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, role, email, name, region, meterId } = req.body;

    // Validate input
    if (!userId || !role) {
      return sendError(res, 'userId and role are required', 400);
    }

    const validRoles = ['USER', 'OPERATOR', 'ADMIN'];
    if (!validRoles.includes(role)) {
      return sendError(res, 'Invalid role', 400);
    }

    try {
      const jwtSecret = process.env.JWT_SECRET || 'mysecretkey';
      const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1d';

      const tokenPayload = {
        userId,
        role,
        ...(email && { email }),
        ...(name && { name }),
        ...(region && { region }),
        ...(meterId && { meterId }),
      };

      const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: jwtExpiresIn } as any);

      logger.info('JWT token generated', { userId, role });

      sendSuccess(res, { token, payload: tokenPayload });
    } catch (error) {
      logger.error('Token generation error', error);
      return sendError(res, 'Token generation failed', 500);
    }
  })
);

export default router;
