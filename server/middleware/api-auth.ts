import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { apiKeys } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface ApiAuthRequest extends Request {
  // `apiKey` es la identidad del llamador. Con X-API-Key es la key compartida;
  // con un Bearer de OAuth es el usuario que conectó el asistente, y entonces
  // `id` es su user_id, así que todo lo que la API atribuye al llamador
  // (createdBy, bitácoras, historial de precios) queda a nombre de la persona.
  apiKey?: {
    id: string;
    role: string;
    name: string;
  };
  // Solo presente en llamadas autenticadas por OAuth.
  oauthUser?: {
    userId: string;
    email: string;
    nombre: string;
    rolIntranet: string;
    scope: string;
    clientId: string;
  };
}

export async function validateApiKey(req: ApiAuthRequest, res: Response, next: NextFunction) {
  const apiKeyHeader = req.headers['x-api-key'] as string;
  const authHeader = req.headers['authorization'] as string | undefined;

  // Camino OAuth: el MCP reenvía el access token del usuario que lo conectó.
  if (!apiKeyHeader && authHeader?.startsWith('Bearer ')) {
    return validateOAuthToken(req, res, next, authHeader.slice(7).trim());
  }

  if (!apiKeyHeader) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="panoramica"');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Se requiere el header X-API-Key o Authorization: Bearer <token OAuth>'
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

// Autenticación por token OAuth (emitido en server/routes-oauth.ts).
// A diferencia de la API key, acá el rol sale del usuario dueño del token y el
// scope puede recortarlo: un token con solo `mcp:read` es readonly aunque quien
// lo pidió sea admin.
async function validateOAuthToken(
  req: ApiAuthRequest,
  res: Response,
  next: NextFunction,
  token: string,
) {
  try {
    const { resolverAccessToken } = await import('../routes-oauth');
    const info = await resolverAccessToken(token);

    if (!info) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="panoramica", error="invalid_token"');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token OAuth inválido, expirado o revocado'
      });
    }

    req.apiKey = {
      id: info.userId,
      role: info.rolApi,
      name: info.nombre,
    };
    req.oauthUser = {
      userId: info.userId,
      email: info.email,
      nombre: info.nombre,
      rolIntranet: info.rolIntranet,
      scope: info.scope,
      clientId: info.clientId,
    };

    next();
  } catch (error) {
    console.error('OAuth authentication error:', error);
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
