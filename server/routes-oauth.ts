// OAuth 2.1 Authorization Server — para el MCP de Panorámica.
//
// El servidor MCP (repo mcp-panoramica-v2) es el Resource Server: publica
// /.well-known/oauth-protected-resource apuntando acá y exige un Bearer.
// Este archivo es el otro lado: descubrimiento, registro dinámico de clientes,
// login + consentimiento, y emisión/rotación de tokens.
//
// Por qué acá y no en el MCP: la intranet ya tiene los usuarios, las contraseñas
// y la sesión. Así el token que termina usando Claude pertenece a una persona
// concreta y /api/external la trata con su propio rol, en vez de la API key
// compartida que hoy le da a cualquiera el poder del dueño de la key.
//
// RFCs implementados: 8414 (metadata), 7591 (DCR), 7636 (PKCE, S256 obligatorio),
// 8707 (resource indicators), 7009 (revocación).

import type { Express, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { storage } from './storage';
import { oauthClients, oauthAuthCodes, oauthTokens, users } from '@shared/schema';
import { eq, and, lt, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

const ACCESS_TOKEN_TTL_SEC = 60 * 60;              // 1 hora
const REFRESH_TOKEN_TTL_SEC = 60 * 24 * 60 * 60;   // 60 días
const AUTH_CODE_TTL_SEC = 5 * 60;                  // 5 minutos
const MAX_PENDING_PER_SESSION = 5;

const SUPPORTED_SCOPES = ['mcp:read', 'mcp:write'] as const;
const DEFAULT_SCOPE = 'mcp:read mcp:write';

// Roles de la intranet habilitados a conectar el MCP. El resto (client,
// tecnico_obra, etc.) no tiene por qué operar el ERP conversacionalmente.
const ROLES_CON_ACCESO_MCP = new Set([
  'admin',
  'supervisor',
  'encargado_area',
  'salesperson',
  'jefe_planta',
  'marketing',
  'mantencion',
  'laboratorio',
  'produccion',
  'logistica_bodega',
  'planificacion',
  'bodega_materias_primas',
]);

// Rol de intranet → rol de la API externa (el vocabulario que espera
// requireApiRole en routes-external.ts). Solo admin conserva admin: el resto
// escribe pero no toca la gestión de API keys.
function mapRolIntranetARolApi(rol: string | null | undefined): 'admin' | 'read_write' | 'readonly' {
  if (rol === 'admin') return 'admin';
  if (rol && ROLES_CON_ACCESO_MCP.has(rol)) return 'read_write';
  return 'readonly';
}

// El scope pedido puede recortar el rol, nunca ampliarlo.
export function rolEfectivo(rolApi: string, scope: string): string {
  const scopes = scope.split(/\s+/).filter(Boolean);
  if (!scopes.includes('mcp:write')) return 'readonly';
  return rolApi;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function randomToken(prefix: string, bytes = 32): string {
  return `${prefix}${crypto.randomBytes(bytes).toString('base64url')}`;
}

function issuerFor(req: Request): string {
  const configured = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (configured) return configured;
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol || 'https';
  return `${proto}://${req.get('host')}`;
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Endpoints públicos del AS: los clientes MCP corren en el navegador, así que
// necesitan CORS para el descubrimiento y el canje del código.
function corsPublico(req: Request, res: Response, next: NextFunction) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Protocol-Version');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}

// Un redirect_uri es aceptable si es https, o loopback en cualquier puerto
// (clientes de escritorio), o un esquema propio de app nativa (cursor://…).
function redirectUriValido(uri: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }
  if (parsed.hash) return false; // el fragmento lo usa el propio redirect
  if (parsed.protocol === 'https:') return true;
  if (parsed.protocol === 'http:') {
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]';
  }
  // Esquema custom de app nativa: exigimos que no sea javascript/data.
  return /^[a-z][a-z0-9+.-]*:$/i.test(parsed.protocol)
    && !['javascript:', 'data:', 'file:', 'vbscript:'].includes(parsed.protocol);
}

function normalizarScope(pedido: string | undefined, permitido: string): string {
  const permitidos = new Set(permitido.split(/\s+/).filter(Boolean));
  if (!pedido) return permitido;
  const filtrados = pedido.split(/\s+/).filter((s) => s && permitidos.has(s) && (SUPPORTED_SCOPES as readonly string[]).includes(s));
  return filtrados.length > 0 ? filtrados.join(' ') : permitido;
}

// ---------------------------------------------------------------------------
// Estado de la autorización en curso (vive en la sesión, no en la URL)
// ---------------------------------------------------------------------------

interface PendingAuth {
  clientId: string;
  clientName: string;
  redirectUri: string;
  state?: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource?: string;
  createdAt: number;
}

declare module 'express-session' {
  interface SessionData {
    oauthPending?: Record<string, PendingAuth>;
    oauthCsrf?: string;
  }
}

function guardarPending(req: Request, pending: PendingAuth): string {
  const requestId = crypto.randomBytes(16).toString('base64url');
  const actuales = req.session.oauthPending ?? {};
  // Cortamos las más viejas para que la sesión no crezca sin techo.
  const entradas = Object.entries(actuales)
    .sort((a, b) => b[1].createdAt - a[1].createdAt)
    .slice(0, MAX_PENDING_PER_SESSION - 1);
  req.session.oauthPending = { ...Object.fromEntries(entradas), [requestId]: pending };
  return requestId;
}

function leerPending(req: Request, requestId: string): PendingAuth | undefined {
  const pending = req.session.oauthPending?.[requestId];
  if (!pending) return undefined;
  if (Date.now() - pending.createdAt > 15 * 60 * 1000) return undefined;
  return pending;
}

function csrfToken(req: Request): string {
  if (!req.session.oauthCsrf) {
    req.session.oauthCsrf = crypto.randomBytes(24).toString('base64url');
  }
  return req.session.oauthCsrf;
}

function csrfValido(req: Request): boolean {
  const enviado = String(req.body?._csrf ?? '');
  const esperado = req.session.oauthCsrf ?? '';
  if (!enviado || !esperado || enviado.length !== esperado.length) return false;
  return crypto.timingSafeEqual(Buffer.from(enviado), Buffer.from(esperado));
}

// ---------------------------------------------------------------------------
// Páginas (server-rendered: no queremos meter el flujo OAuth en el SPA)
// ---------------------------------------------------------------------------

const ESTILOS = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 1.5rem; background: #f1f5f9; color: #1e293b;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .card {
    width: 100%; max-width: 460px; background: #fff; border: 1px solid rgba(226,232,240,.7);
    border-radius: 24px; box-shadow: 0 10px 30px rgba(15,23,42,.08); padding: 2rem;
  }
  .marca { display: flex; align-items: center; gap: .75rem; margin-bottom: 1.5rem; }
  .marca .chip {
    width: 48px; height: 48px; border-radius: 16px; background: #fd6301; color: #fff;
    display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem;
    box-shadow: 0 8px 18px rgba(253,99,1,.25);
  }
  .marca .titulo { font-weight: 700; font-size: 1.05rem; color: #1e293b; }
  .marca .bajada { font-size: .8rem; color: #64748b; }
  h1 { font-size: 1.25rem; font-weight: 700; color: #1e293b; margin: 0 0 .5rem; }
  p { color: #64748b; line-height: 1.5; margin: 0 0 1rem; font-size: .925rem; }
  label { display: block; font-size: .7rem; text-transform: uppercase; letter-spacing: .06em;
    font-weight: 700; color: #94a3b8; margin-bottom: .35rem; }
  input[type=email], input[type=password] {
    width: 100%; padding: .7rem .85rem; border: 1px solid #e2e8f0; border-radius: 12px;
    background: rgba(248,250,252,.6); font-size: .95rem; color: #1e293b; margin-bottom: 1rem;
  }
  input:focus-visible { outline: none; border-color: #fd6301; box-shadow: 0 0 0 3px rgba(253,99,1,.2); }
  .permisos { list-style: none; padding: 0; margin: 0 0 1.25rem; }
  .permisos li { display: flex; gap: .6rem; padding: .55rem 0; font-size: .9rem; color: #334155;
    border-bottom: 1px solid rgba(226,232,240,.7); }
  .permisos li:last-child { border-bottom: none; }
  .permisos .punto { color: #fd6301; font-weight: 700; }
  .quien { display: flex; align-items: center; justify-content: space-between; gap: .75rem;
    background: rgba(248,250,252,.8); border: 1px solid rgba(226,232,240,.7);
    border-radius: 16px; padding: .75rem .9rem; margin-bottom: 1.25rem; font-size: .875rem; }
  .quien .rol { font-size: .7rem; text-transform: uppercase; letter-spacing: .05em;
    font-weight: 700; color: #fd6301; }
  .acciones { display: flex; gap: .6rem; }
  button {
    flex: 1; padding: .8rem 1rem; border-radius: 16px; border: none; font-size: .95rem;
    font-weight: 600; cursor: pointer; transition: all .15s ease;
  }
  .primario { background: #fd6301; color: #fff; box-shadow: 0 6px 16px rgba(253,99,1,.25); }
  .primario:hover { background: #e35400; }
  .secundario { background: #fff; color: #64748b; border: 1px solid #e2e8f0; }
  .secundario:hover { color: #334155; border-color: #cbd5e1; }
  .error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c;
    border-radius: 12px; padding: .7rem .85rem; font-size: .875rem; margin-bottom: 1rem; }
  .pie { margin-top: 1.25rem; font-size: .75rem; color: #94a3b8; text-align: center; line-height: 1.5; }
  @media (prefers-color-scheme: dark) {
    body { background: #020617; color: #f1f5f9; }
    .card { background: #0f172a; border-color: rgba(51,65,85,.7); box-shadow: 0 10px 30px rgba(0,0,0,.4); }
    .marca .titulo, h1 { color: #f1f5f9; }
    input[type=email], input[type=password] { background: rgba(15,23,42,.6); border-color: #334155; color: #f1f5f9; }
    .permisos li { color: #cbd5e1; border-bottom-color: rgba(51,65,85,.7); }
    .quien { background: rgba(15,23,42,.6); border-color: rgba(51,65,85,.7); }
    .secundario { background: transparent; color: #94a3b8; border-color: #334155; }
    .error { background: rgba(127,29,29,.25); border-color: #7f1d1d; color: #fca5a5; }
  }
`;

function pagina(titulo: string, contenido: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(titulo)} · Panorámica</title>
<style>${ESTILOS}</style>
</head>
<body>
  <div class="card">
    <div class="marca">
      <div class="chip">P</div>
      <div>
        <div class="titulo">Intranet Panorámica</div>
        <div class="bajada">Conexión de asistentes (MCP)</div>
      </div>
    </div>
    ${contenido}
  </div>
</body>
</html>`;
}

function paginaError(res: Response, status: number, titulo: string, detalle: string) {
  res.status(status).type('html').send(pagina(titulo, `
    <h1>${esc(titulo)}</h1>
    <p>${esc(detalle)}</p>
    <p class="pie">Si esto no lo esperabas, cerrá esta ventana y avisale al equipo de sistemas.</p>
  `));
}

function paginaLogin(req: Request, requestId: string, pending: PendingAuth, error?: string): string {
  return pagina('Iniciar sesión', `
    <h1>Iniciá sesión</h1>
    <p><strong>${esc(pending.clientName)}</strong> quiere conectarse a la intranet con tu cuenta.</p>
    ${error ? `<div class="error">${esc(error)}</div>` : ''}
    <form method="post" action="/oauth/authorize/login">
      <input type="hidden" name="_csrf" value="${esc(csrfToken(req))}">
      <input type="hidden" name="request_id" value="${esc(requestId)}">
      <label for="email">Correo</label>
      <input id="email" name="email" type="email" autocomplete="username" required autofocus>
      <label for="password">Contraseña</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <div class="acciones">
        <button type="submit" class="primario">Continuar</button>
      </div>
    </form>
    <p class="pie">Son las mismas credenciales de la intranet. Nunca se las compartimos al asistente.</p>
  `);
}

const DESCRIPCION_SCOPE: Record<string, string> = {
  'mcp:read': 'Leer información de la intranet: ventas, clientes, stock, cotizaciones, tareas y reportes.',
  'mcp:write': 'Crear y modificar datos: cotizaciones, tareas, seguimientos, notificaciones y pedidos.',
};

function paginaConsentimiento(req: Request, requestId: string, pending: PendingAuth, usuario: Express.User): string {
  const scopes = pending.scope.split(/\s+/).filter(Boolean);
  const rolApi = rolEfectivo(mapRolIntranetARolApi(usuario.role), pending.scope);
  const nombre = [usuario.firstName, usuario.lastName].filter(Boolean).join(' ') || usuario.email;

  return pagina('Autorizar conexión', `
    <h1>Autorizar a ${esc(pending.clientName)}</h1>
    <p>Va a operar la intranet en tu nombre, con tus mismos permisos.</p>
    <div class="quien">
      <div>
        <div><strong>${esc(nombre)}</strong></div>
        <div style="color:#94a3b8">${esc(usuario.email)}</div>
      </div>
      <div class="rol">${esc(rolApi === 'readonly' ? 'solo lectura' : rolApi === 'admin' ? 'admin' : 'lectura y escritura')}</div>
    </div>
    <ul class="permisos">
      ${scopes.map((s) => `<li><span class="punto">•</span><span>${esc(DESCRIPCION_SCOPE[s] ?? s)}</span></li>`).join('')}
    </ul>
    <form method="post" action="/oauth/authorize/decision">
      <input type="hidden" name="_csrf" value="${esc(csrfToken(req))}">
      <input type="hidden" name="request_id" value="${esc(requestId)}">
      <div class="acciones">
        <button type="submit" name="decision" value="deny" class="secundario">Cancelar</button>
        <button type="submit" name="decision" value="allow" class="primario">Autorizar</button>
      </div>
    </form>
    <p class="pie">Podés revocar el acceso cuando quieras desde la intranet.<br>Todo lo que haga el asistente queda registrado a tu nombre.</p>
  `);
}

// ---------------------------------------------------------------------------
// Emisión de códigos y tokens
// ---------------------------------------------------------------------------

async function emitirCodigo(pending: PendingAuth, userId: string): Promise<string> {
  const code = randomToken('pnr_code_');
  await db.insert(oauthAuthCodes).values({
    codeHash: sha256(code),
    clientId: pending.clientId,
    userId,
    redirectUri: pending.redirectUri,
    scope: pending.scope,
    codeChallenge: pending.codeChallenge,
    codeChallengeMethod: pending.codeChallengeMethod,
    resource: pending.resource ?? null,
    expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SEC * 1000),
  });
  return code;
}

interface ParTokens {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

async function emitirTokens(params: {
  grantId: string;
  clientId: string;
  userId: string;
  scope: string;
  resource?: string | null;
}): Promise<ParTokens> {
  const accessToken = randomToken('pnr_mcp_');
  const refreshToken = randomToken('pnr_ref_', 48);
  const ahora = Date.now();

  await db.insert(oauthTokens).values([
    {
      tokenHash: sha256(accessToken),
      kind: 'access',
      grantId: params.grantId,
      clientId: params.clientId,
      userId: params.userId,
      scope: params.scope,
      resource: params.resource ?? null,
      expiresAt: new Date(ahora + ACCESS_TOKEN_TTL_SEC * 1000),
    },
    {
      tokenHash: sha256(refreshToken),
      kind: 'refresh',
      grantId: params.grantId,
      clientId: params.clientId,
      userId: params.userId,
      scope: params.scope,
      resource: params.resource ?? null,
      expiresAt: new Date(ahora + REFRESH_TOKEN_TTL_SEC * 1000),
    },
  ]);

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SEC,
    refresh_token: refreshToken,
    scope: params.scope,
  };
}

/**
 * Resuelve un access token a su usuario. Lo usan el middleware de /api/external
 * y /oauth/userinfo. Devuelve null si el token no existe, venció o fue revocado.
 */
export async function resolverAccessToken(token: string): Promise<{
  tokenId: string;
  userId: string;
  clientId: string;
  scope: string;
  resource: string | null;
  email: string;
  nombre: string;
  rolIntranet: string;
  rolApi: string;
} | null> {
  if (!token) return null;

  const [fila] = await db
    .select({
      id: oauthTokens.id,
      userId: oauthTokens.userId,
      clientId: oauthTokens.clientId,
      scope: oauthTokens.scope,
      resource: oauthTokens.resource,
      expiresAt: oauthTokens.expiresAt,
      revokedAt: oauthTokens.revokedAt,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
    })
    .from(oauthTokens)
    .innerJoin(users, eq(users.id, oauthTokens.userId))
    .where(and(eq(oauthTokens.tokenHash, sha256(token)), eq(oauthTokens.kind, 'access')))
    .limit(1);

  if (!fila) return null;
  if (fila.revokedAt) return null;
  if (fila.expiresAt.getTime() < Date.now()) return null;

  // Si al usuario le sacaron el permiso después de conectar, el token deja de servir.
  if (!ROLES_CON_ACCESO_MCP.has(fila.role ?? '')) return null;

  db.update(oauthTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(oauthTokens.id, fila.id))
    .then(() => {})
    .catch((err) => console.error('[oauth] no se pudo actualizar last_used_at:', err?.message));

  const rolApi = rolEfectivo(mapRolIntranetARolApi(fila.role), fila.scope);

  return {
    tokenId: fila.id,
    userId: fila.userId,
    clientId: fila.clientId,
    scope: fila.scope,
    resource: fila.resource,
    email: fila.email,
    nombre: [fila.firstName, fila.lastName].filter(Boolean).join(' ') || fila.email,
    rolIntranet: fila.role ?? 'user',
    rolApi,
  };
}

// ---------------------------------------------------------------------------
// Autenticación del cliente en /oauth/token
// ---------------------------------------------------------------------------

async function autenticarCliente(req: Request): Promise<
  | { ok: true; cliente: typeof oauthClients.$inferSelect }
  | { ok: false; error: string; descripcion: string }
> {
  let clientId = String(req.body?.client_id ?? '');
  let clientSecret = req.body?.client_secret ? String(req.body.client_secret) : undefined;

  // client_secret_basic: Authorization: Basic base64(client_id:client_secret)
  const auth = req.headers.authorization;
  if (auth?.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    const sep = decoded.indexOf(':');
    if (sep > 0) {
      clientId = decodeURIComponent(decoded.slice(0, sep));
      clientSecret = decodeURIComponent(decoded.slice(sep + 1));
    }
  }

  if (!clientId) {
    return { ok: false, error: 'invalid_client', descripcion: 'Falta client_id' };
  }

  const [cliente] = await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1);
  if (!cliente || !cliente.isActive) {
    return { ok: false, error: 'invalid_client', descripcion: 'Cliente desconocido' };
  }

  if (cliente.clientSecretHash) {
    if (!clientSecret || !(await bcrypt.compare(clientSecret, cliente.clientSecretHash))) {
      return { ok: false, error: 'invalid_client', descripcion: 'client_secret inválido' };
    }
  }

  return { ok: true, cliente };
}

function errorToken(res: Response, status: number, error: string, descripcion: string) {
  res.status(status).json({ error, error_description: descripcion });
}

// ---------------------------------------------------------------------------
// Registro de rutas
// ---------------------------------------------------------------------------

export function registerOAuthRoutes(app: Express) {
  // ---- Descubrimiento (RFC 8414) ----
  // Se sirve también con el sufijo de path por si el cliente arma la URL
  // insertando el path del recurso, como permite el RFC.
  const metadata = (req: Request, res: Response) => {
    const issuer = issuerFor(req);
    res.json({
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      registration_endpoint: `${issuer}/oauth/register`,
      revocation_endpoint: `${issuer}/oauth/revoke`,
      userinfo_endpoint: `${issuer}/oauth/userinfo`,
      scopes_supported: [...SUPPORTED_SCOPES],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
      revocation_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
      service_documentation: 'https://github.com/panoramicadev/mcp-panoramica-v2',
    });
  };

  app.get('/.well-known/oauth-authorization-server', corsPublico, metadata);
  app.get('/.well-known/oauth-authorization-server/*', corsPublico, metadata);

  // ---- Registro dinámico de clientes (RFC 7591) ----
  // Abierto a propósito: es lo que hace que el connector de Claude se conecte
  // sin pegar credenciales a mano. La puerta real es el login + consentimiento
  // de más abajo — registrarse no da acceso a ningún dato.
  app.post('/oauth/register', corsPublico, async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const redirectUris: unknown = body.redirect_uris;

      if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
        return res.status(400).json({
          error: 'invalid_redirect_uri',
          error_description: 'redirect_uris es obligatorio y debe ser un arreglo',
        });
      }
      if (redirectUris.length > 10) {
        return res.status(400).json({ error: 'invalid_redirect_uri', error_description: 'Demasiados redirect_uris' });
      }
      for (const uri of redirectUris) {
        if (typeof uri !== 'string' || !redirectUriValido(uri)) {
          return res.status(400).json({
            error: 'invalid_redirect_uri',
            error_description: `redirect_uri no permitido: ${String(uri).slice(0, 120)}`,
          });
        }
      }

      const authMethod = ['none', 'client_secret_post', 'client_secret_basic'].includes(body.token_endpoint_auth_method)
        ? body.token_endpoint_auth_method
        : 'none';

      const grantTypes: string[] = Array.isArray(body.grant_types) && body.grant_types.length > 0
        ? body.grant_types.filter((g: unknown) => g === 'authorization_code' || g === 'refresh_token')
        : ['authorization_code', 'refresh_token'];

      if (!grantTypes.includes('authorization_code')) {
        return res.status(400).json({
          error: 'invalid_client_metadata',
          error_description: 'Solo se soporta el grant authorization_code (con refresh_token opcional)',
        });
      }

      const scope = normalizarScope(typeof body.scope === 'string' ? body.scope : undefined, DEFAULT_SCOPE);
      const clientId = randomToken('pnr_client_', 16);
      const clientSecret = authMethod === 'none' ? undefined : randomToken('pnr_secret_', 32);

      await db.insert(oauthClients).values({
        clientId,
        clientSecretHash: clientSecret ? await bcrypt.hash(clientSecret, 10) : null,
        clientName: String(body.client_name ?? 'Cliente MCP').slice(0, 120),
        clientUri: typeof body.client_uri === 'string' ? body.client_uri.slice(0, 500) : null,
        logoUri: typeof body.logo_uri === 'string' ? body.logo_uri.slice(0, 500) : null,
        redirectUris: redirectUris as string[],
        grantTypes,
        tokenEndpointAuthMethod: authMethod,
        scope,
      });

      console.log(`[oauth] cliente registrado: ${body.client_name ?? 'sin nombre'} (${clientId})`);

      return res.status(201).json({
        client_id: clientId,
        ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: String(body.client_name ?? 'Cliente MCP').slice(0, 120),
        redirect_uris: redirectUris,
        grant_types: grantTypes,
        response_types: ['code'],
        token_endpoint_auth_method: authMethod,
        scope,
      });
    } catch (error: any) {
      console.error('[oauth] error en registro dinámico:', error?.message);
      return res.status(500).json({ error: 'server_error', error_description: 'No se pudo registrar el cliente' });
    }
  });

  // ---- Autorización: validación, login y consentimiento ----
  app.get('/oauth/authorize', async (req: Request, res: Response) => {
    try {
      const {
        response_type: responseType,
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        scope: scopePedido,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        resource,
      } = req.query as Record<string, string | undefined>;

      if (!clientId) {
        return paginaError(res, 400, 'Solicitud inválida', 'Falta el parámetro client_id.');
      }

      const [cliente] = await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1);
      if (!cliente || !cliente.isActive) {
        return paginaError(res, 400, 'Aplicación desconocida', 'El cliente que pide acceso no está registrado o fue desactivado.');
      }

      // redirect_uri se compara exacto: es lo único que impide que un tercero
      // se lleve el código a otro lado. Si no valida, NO redirigimos.
      if (!redirectUri || !cliente.redirectUris.includes(redirectUri)) {
        return paginaError(res, 400, 'Redirección no permitida', 'El redirect_uri no coincide con ninguno registrado por la aplicación.');
      }

      // A partir de acá los errores sí se devuelven por redirect, como pide el RFC.
      const redirigirConError = (error: string, descripcion: string) => {
        const url = new URL(redirectUri);
        url.searchParams.set('error', error);
        url.searchParams.set('error_description', descripcion);
        if (state) url.searchParams.set('state', state);
        return res.redirect(url.toString());
      };

      if (responseType !== 'code') {
        return redirigirConError('unsupported_response_type', 'Solo se soporta response_type=code');
      }
      if (!codeChallenge) {
        return redirigirConError('invalid_request', 'PKCE es obligatorio: falta code_challenge');
      }
      if ((codeChallengeMethod ?? 'plain') !== 'S256') {
        return redirigirConError('invalid_request', 'Solo se acepta code_challenge_method=S256');
      }

      const pending: PendingAuth = {
        clientId: cliente.clientId,
        clientName: cliente.clientName,
        redirectUri,
        state,
        scope: normalizarScope(scopePedido, cliente.scope),
        codeChallenge,
        codeChallengeMethod: 'S256',
        resource,
        createdAt: Date.now(),
      };
      const requestId = guardarPending(req, pending);

      if (!req.isAuthenticated?.() || !req.user) {
        return res.type('html').send(paginaLogin(req, requestId, pending));
      }

      if (!ROLES_CON_ACCESO_MCP.has(req.user.role)) {
        return paginaError(res, 403, 'Sin acceso', 'Tu cuenta no tiene permiso para conectar asistentes a la intranet. Pedíselo a un administrador.');
      }

      return res.type('html').send(paginaConsentimiento(req, requestId, pending, req.user));
    } catch (error: any) {
      console.error('[oauth] error en /oauth/authorize:', error?.message);
      return paginaError(res, 500, 'Error del servidor', 'No pudimos procesar la autorización. Intentá de nuevo en unos minutos.');
    }
  });

  // Login dentro del flujo OAuth (no toca /api/auth/login para no mezclar
  // el contrato JSON del SPA con este formulario).
  app.post('/oauth/authorize/login', async (req: Request, res: Response) => {
    try {
      const requestId = String(req.body?.request_id ?? '');
      const pending = leerPending(req, requestId);
      if (!pending) {
        return paginaError(res, 400, 'La solicitud expiró', 'Volvé a iniciar la conexión desde la aplicación.');
      }
      if (!csrfValido(req)) {
        return paginaError(res, 403, 'Solicitud rechazada', 'El formulario no es válido. Volvé a empezar desde la aplicación.');
      }

      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const password = String(req.body?.password ?? '');
      const usuario = email ? await storage.getUserByEmail(email) : undefined;

      if (!usuario || !usuario.password || !(await bcrypt.compare(password, usuario.password))) {
        return res.status(401).type('html').send(paginaLogin(req, requestId, pending, 'Correo o contraseña incorrectos.'));
      }

      if (!ROLES_CON_ACCESO_MCP.has(usuario.role ?? '')) {
        return paginaError(res, 403, 'Sin acceso', 'Tu cuenta no tiene permiso para conectar asistentes a la intranet. Pedíselo a un administrador.');
      }

      const paraSesion: Express.User = {
        ...usuario,
        firstName: usuario.firstName || undefined,
        lastName: usuario.lastName || undefined,
        profileImageUrl: usuario.profileImageUrl || undefined,
        role: usuario.role || 'user',
      };

      // keepSessionInfo: passport regenera la sesión al loguear (bien, contra
      // fijación de sesión) y sin esto se lleva puestos oauthPending y el CSRF,
      // así que el consentimiento siguiente no encuentra la solicitud.
      req.login(paraSesion, { session: true, keepSessionInfo: true }, (err) => {
        if (err) {
          console.error('[oauth] error al iniciar sesión:', err?.message);
          return paginaError(res, 500, 'Error del servidor', 'No pudimos iniciar tu sesión. Intentá de nuevo.');
        }
        return res.type('html').send(paginaConsentimiento(req, requestId, pending, paraSesion));
      });
    } catch (error: any) {
      console.error('[oauth] error en login OAuth:', error?.message);
      return paginaError(res, 500, 'Error del servidor', 'No pudimos procesar el inicio de sesión.');
    }
  });

  app.post('/oauth/authorize/decision', async (req: Request, res: Response) => {
    try {
      const requestId = String(req.body?.request_id ?? '');
      const pending = leerPending(req, requestId);
      if (!pending) {
        return paginaError(res, 400, 'La solicitud expiró', 'Volvé a iniciar la conexión desde la aplicación.');
      }
      if (!csrfValido(req)) {
        return paginaError(res, 403, 'Solicitud rechazada', 'El formulario no es válido. Volvé a empezar desde la aplicación.');
      }
      if (!req.isAuthenticated?.() || !req.user) {
        return res.type('html').send(paginaLogin(req, requestId, pending));
      }
      if (!ROLES_CON_ACCESO_MCP.has(req.user.role)) {
        return paginaError(res, 403, 'Sin acceso', 'Tu cuenta no tiene permiso para conectar asistentes a la intranet.');
      }

      // La solicitud se consume acá: un código por consentimiento.
      if (req.session.oauthPending) delete req.session.oauthPending[requestId];

      const url = new URL(pending.redirectUri);
      if (pending.state) url.searchParams.set('state', pending.state);

      if (req.body?.decision !== 'allow') {
        url.searchParams.set('error', 'access_denied');
        url.searchParams.set('error_description', 'El usuario canceló la autorización');
        return res.redirect(url.toString());
      }

      const code = await emitirCodigo(pending, req.user.id);
      url.searchParams.set('code', code);

      console.log(`[oauth] autorización concedida: ${req.user.email} → ${pending.clientName} (${pending.scope})`);
      return res.redirect(url.toString());
    } catch (error: any) {
      console.error('[oauth] error en la decisión de consentimiento:', error?.message);
      return paginaError(res, 500, 'Error del servidor', 'No pudimos completar la autorización.');
    }
  });

  // ---- Canje y refresco de tokens ----
  app.post('/oauth/token', corsPublico, async (req: Request, res: Response) => {
    try {
      const grantType = String(req.body?.grant_type ?? '');
      const auth = await autenticarCliente(req);
      if (!auth.ok) return errorToken(res, 401, auth.error, auth.descripcion);
      const cliente = auth.cliente;

      db.update(oauthClients)
        .set({ lastUsedAt: new Date() })
        .where(eq(oauthClients.id, cliente.id))
        .then(() => {})
        .catch(() => {});

      if (grantType === 'authorization_code') {
        const code = String(req.body?.code ?? '');
        const codeVerifier = String(req.body?.code_verifier ?? '');
        const redirectUri = String(req.body?.redirect_uri ?? '');

        if (!code || !codeVerifier) {
          return errorToken(res, 400, 'invalid_request', 'Faltan code o code_verifier');
        }

        const [registro] = await db
          .select()
          .from(oauthAuthCodes)
          .where(eq(oauthAuthCodes.codeHash, sha256(code)))
          .limit(1);

        if (!registro) return errorToken(res, 400, 'invalid_grant', 'Código inválido');

        // Código reusado: alguien lo interceptó o el cliente reintentó. Se
        // revoca lo emitido por ESE código, sin tocar otras sesiones que la
        // misma persona pueda tener abiertas con el mismo cliente.
        if (registro.consumedAt) {
          if (registro.grantId) {
            await db.update(oauthTokens)
              .set({ revokedAt: new Date() })
              .where(and(eq(oauthTokens.grantId, registro.grantId), sql`${oauthTokens.revokedAt} IS NULL`));
          }
          console.warn(`[oauth] código reusado para el cliente ${registro.clientId}: tokens revocados`);
          return errorToken(res, 400, 'invalid_grant', 'El código ya fue usado');
        }
        if (registro.expiresAt.getTime() < Date.now()) {
          return errorToken(res, 400, 'invalid_grant', 'El código expiró');
        }
        if (registro.clientId !== cliente.clientId) {
          return errorToken(res, 400, 'invalid_grant', 'El código no pertenece a este cliente');
        }
        if (redirectUri && redirectUri !== registro.redirectUri) {
          return errorToken(res, 400, 'invalid_grant', 'redirect_uri no coincide con el de la autorización');
        }

        // PKCE: S256(code_verifier) debe dar el challenge guardado.
        const calculado = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
        if (calculado !== registro.codeChallenge) {
          return errorToken(res, 400, 'invalid_grant', 'code_verifier inválido');
        }

        const grantId = crypto.randomUUID();
        await db.update(oauthAuthCodes)
          .set({ consumedAt: new Date(), grantId })
          .where(eq(oauthAuthCodes.id, registro.id));

        const tokens = await emitirTokens({
          grantId,
          clientId: registro.clientId,
          userId: registro.userId,
          scope: registro.scope,
          resource: req.body?.resource ?? registro.resource,
        });

        return res.json(tokens);
      }

      if (grantType === 'refresh_token') {
        const refreshToken = String(req.body?.refresh_token ?? '');
        if (!refreshToken) return errorToken(res, 400, 'invalid_request', 'Falta refresh_token');

        const [registro] = await db
          .select()
          .from(oauthTokens)
          .where(and(eq(oauthTokens.tokenHash, sha256(refreshToken)), eq(oauthTokens.kind, 'refresh')))
          .limit(1);

        if (!registro) return errorToken(res, 400, 'invalid_grant', 'Refresh token inválido');
        if (registro.clientId !== cliente.clientId) {
          return errorToken(res, 400, 'invalid_grant', 'El refresh token no pertenece a este cliente');
        }

        // Rotación: si vuelve a aparecer un refresh ya usado, se cae toda la
        // familia. Es la detección de robo que pide OAuth 2.1.
        if (registro.revokedAt) {
          await db.update(oauthTokens)
            .set({ revokedAt: new Date() })
            .where(and(eq(oauthTokens.grantId, registro.grantId), sql`${oauthTokens.revokedAt} IS NULL`));
          console.warn(`[oauth] refresh token reusado (grant ${registro.grantId}): familia revocada`);
          return errorToken(res, 400, 'invalid_grant', 'Refresh token ya utilizado');
        }
        if (registro.expiresAt.getTime() < Date.now()) {
          return errorToken(res, 400, 'invalid_grant', 'El refresh token expiró');
        }

        const [usuario] = await db.select().from(users).where(eq(users.id, registro.userId)).limit(1);
        if (!usuario || !ROLES_CON_ACCESO_MCP.has(usuario.role ?? '')) {
          return errorToken(res, 400, 'invalid_grant', 'El usuario ya no tiene acceso');
        }

        // El access anterior del mismo grant deja de valer al rotar.
        await db.update(oauthTokens)
          .set({ revokedAt: new Date() })
          .where(and(eq(oauthTokens.grantId, registro.grantId), sql`${oauthTokens.revokedAt} IS NULL`));

        const scope = normalizarScope(
          typeof req.body?.scope === 'string' ? req.body.scope : undefined,
          registro.scope,
        );

        const tokens = await emitirTokens({
          grantId: registro.grantId,
          clientId: registro.clientId,
          userId: registro.userId,
          scope,
          resource: req.body?.resource ?? registro.resource,
        });

        return res.json(tokens);
      }

      return errorToken(res, 400, 'unsupported_grant_type', `grant_type no soportado: ${grantType}`);
    } catch (error: any) {
      console.error('[oauth] error en /oauth/token:', error?.message);
      return errorToken(res, 500, 'server_error', 'No se pudo emitir el token');
    }
  });

  // ---- Revocación (RFC 7009) ----
  app.post('/oauth/revoke', corsPublico, async (req: Request, res: Response) => {
    try {
      const token = String(req.body?.token ?? '');
      if (!token) return res.status(200).json({}); // el RFC pide 200 igual

      const [registro] = await db
        .select()
        .from(oauthTokens)
        .where(eq(oauthTokens.tokenHash, sha256(token)))
        .limit(1);

      if (registro) {
        // Revocar cualquiera de los dos tokens mata la sesión completa.
        await db.update(oauthTokens)
          .set({ revokedAt: new Date() })
          .where(and(eq(oauthTokens.grantId, registro.grantId), sql`${oauthTokens.revokedAt} IS NULL`));
      }

      return res.status(200).json({});
    } catch (error: any) {
      console.error('[oauth] error en /oauth/revoke:', error?.message);
      return res.status(200).json({});
    }
  });

  // ---- Userinfo: el MCP lo usa para validar el token antes de abrir la sesión ----
  app.get('/oauth/userinfo', corsPublico, async (req: Request, res: Response) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="panoramica"');
      return res.status(401).json({ error: 'invalid_token', error_description: 'Falta el header Authorization: Bearer' });
    }

    const info = await resolverAccessToken(header.slice(7).trim());
    if (!info) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="panoramica", error="invalid_token"');
      return res.status(401).json({ error: 'invalid_token', error_description: 'Token inválido, expirado o revocado' });
    }

    return res.json({
      sub: info.userId,
      email: info.email,
      name: info.nombre,
      role: info.rolIntranet,
      api_role: info.rolApi,
      scope: info.scope,
      client_id: info.clientId,
      resource: info.resource,
    });
  });

  // ---- Limpieza de códigos y tokens vencidos ----
  const limpiar = async () => {
    try {
      const ahora = new Date();
      await db.delete(oauthAuthCodes).where(lt(oauthAuthCodes.expiresAt, ahora));
      await db.delete(oauthTokens).where(lt(oauthTokens.expiresAt, new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000)));
    } catch (error: any) {
      console.error('[oauth] error al limpiar tokens vencidos:', error?.message);
    }
  };
  setTimeout(limpiar, 90_000).unref?.();
  setInterval(limpiar, 6 * 60 * 60 * 1000).unref?.();

  console.log('🔐 OAuth 2.1 para MCP registrado (/oauth/* + /.well-known/oauth-authorization-server)');
}
