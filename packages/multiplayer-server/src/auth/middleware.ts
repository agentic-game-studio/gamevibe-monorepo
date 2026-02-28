import jwt from 'jsonwebtoken';
import { logger } from '@gamevibe/shared';

const log = logger('AuthMiddleware');

export interface AuthPayload {
  userId: string;
  username: string;
  avatar?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'gamevibe-secret-key';

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch (error) {
    log.error('JWT verification failed:', error);
    return null;
  }
}

export async function authMiddleware(token: string): Promise<AuthPayload | null> {
  if (!token) {
    log.warn('No authentication token provided');
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    log.warn('Invalid authentication token');
    return null;
  }

  return payload;
}