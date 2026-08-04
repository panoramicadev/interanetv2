-- OAuth 2.1: la intranet como Authorization Server del MCP.
-- Reemplaza la API key compartida del servidor MCP por tokens con dueño:
-- cada conexión queda atada a un usuario de `users` y opera con su rol.

CREATE TABLE IF NOT EXISTS oauth_clients (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id VARCHAR NOT NULL UNIQUE,
  client_secret_hash VARCHAR,
  client_name VARCHAR NOT NULL,
  client_uri VARCHAR,
  logo_uri VARCHAR,
  redirect_uris JSONB NOT NULL,
  grant_types JSONB NOT NULL DEFAULT '["authorization_code","refresh_token"]'::jsonb,
  token_endpoint_auth_method VARCHAR NOT NULL DEFAULT 'none',
  scope TEXT NOT NULL DEFAULT 'mcp:read mcp:write',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "IDX_oauth_clients_client_id" ON oauth_clients (client_id);

CREATE TABLE IF NOT EXISTS oauth_auth_codes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash VARCHAR NOT NULL UNIQUE,
  client_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL,
  redirect_uri VARCHAR NOT NULL,
  scope TEXT NOT NULL,
  code_challenge VARCHAR NOT NULL,
  code_challenge_method VARCHAR NOT NULL DEFAULT 'S256',
  resource VARCHAR,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP,
  grant_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_oauth_auth_codes_hash" ON oauth_auth_codes (code_hash);
CREATE INDEX IF NOT EXISTS "IDX_oauth_auth_codes_expires" ON oauth_auth_codes (expires_at);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash VARCHAR NOT NULL UNIQUE,
  kind VARCHAR NOT NULL,
  grant_id VARCHAR NOT NULL,
  client_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL,
  scope TEXT NOT NULL,
  resource VARCHAR,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_oauth_tokens_hash" ON oauth_tokens (token_hash);
CREATE INDEX IF NOT EXISTS "IDX_oauth_tokens_grant" ON oauth_tokens (grant_id);
CREATE INDEX IF NOT EXISTS "IDX_oauth_tokens_user" ON oauth_tokens (user_id);
