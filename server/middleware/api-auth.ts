import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { apiKeys } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface ApiAuthRequest extends Request {
  apiKey?: {
    id: string;
    role: string;
    name: string;
  };
}

export async function validateApiKey(req: ApiAuthRequest, res: Response, next: NextFunction) {
  const apiKeyHeader = req.headers['x-api-key'] as string;

  if (!apiKeyHeader) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'X-API-Key header is required'
    });
  }

  try {
    // Get all active API keys
    const activeKeys = await db
      .select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.isActive, true)
      ));

    // Check if the provided key matches any active key
    let matchedKey = null;
    for (const key of activeKeys) {
      const isMatch = await bcrypt.compare(apiKeyHeader, key.keyHash);
      if (isMatch) {
        // Check expiration
        if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'API key has expired'
          });
        }
        matchedKey = key;
        break;
      }
    }

    if (!matchedKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    }

    // Update usage tracking (fire and forget)
    db.update(apiKeys)
      .set({
        lastUsedAt: new Date(),
        usageCount: matchedKey.usageCount + 1
      })
      .where(eq(apiKeys.id, matchedKey.id))
      .then(() => {})
      .catch(err => console.error('Error updating API key usage:', err));

    // Attach API key info to request
    req.apiKey = {
      id: matchedKey.id,
      role: matchedKey.role,
      name: matchedKey.name
    };

    next();
  } catch (error) {
    console.error('API authentication error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed'
    });
  }
}

// Middleware to check if API key has specific role
export function requireApiRole(allowedRoles: string[]) {
  return (req: ApiAuthRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key required'
      });
    }

    if (!allowedRoles.includes(req.apiKey.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This endpoint requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}
