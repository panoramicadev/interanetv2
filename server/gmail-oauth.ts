import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { db } from './db';
import { smtpConfig } from '../shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

const CONFIG_ID = 'default';

function getRedirectUri(): string {
  if (process.env.GMAIL_OAUTH_REDIRECT_URI) {
    return process.env.GMAIL_OAUTH_REDIRECT_URI;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}/api/oauth/google/callback`;
  }
  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/api/oauth/google/callback`;
  }
  return 'http://localhost:5000/api/oauth/google/callback';
}

function getOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured (GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET missing)');
  }
  
  const redirectUri = getRedirectUri();
  console.log('[Gmail OAuth] Using redirect URI:', redirectUri);
  
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

const stateTokens = new Map<string, { timestamp: number }>();

function cleanupStateTokens(): void {
  const now = Date.now();
  const FIVE_MINUTES = 5 * 60 * 1000;
  for (const [token, data] of stateTokens.entries()) {
    if (now - data.timestamp > FIVE_MINUTES) {
      stateTokens.delete(token);
    }
  }
}

export function isOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

export function getAuthUrl(): { url: string; state: string } {
  const oauth2Client = getOAuth2Client();
  
  const state = crypto.randomBytes(32).toString('hex');
  cleanupStateTokens();
  stateTokens.set(state, { timestamp: Date.now() });
  
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: state,
  });
  
  console.log('[Gmail OAuth] Generated auth URL with state:', state.substring(0, 8) + '...');
  return { url, state };
}

export function validateStateToken(state: string): boolean {
  cleanupStateTokens();
  
  if (!state || !stateTokens.has(state)) {
    console.log('[Gmail OAuth] Invalid or expired state token');
    return false;
  }
  
  stateTokens.delete(state);
  console.log('[Gmail OAuth] State token validated and consumed');
  return true;
}

export async function handleCallback(code: string): Promise<{ email: string; success: boolean }> {
  console.log('[Gmail OAuth] Processing callback with code');
  const oauth2Client = getOAuth2Client();
  
  const { tokens } = await oauth2Client.getToken(code);
  console.log('[Gmail OAuth] Token exchange successful');
  
  if (!tokens.access_token) {
    throw new Error('No access token received from Google');
  }
  
  if (!tokens.refresh_token) {
    console.log('[Gmail OAuth] Warning: No refresh token received - user may have previously authorized');
    throw new Error('No se recibió refresh token. Revoca el acceso en https://myaccount.google.com/permissions y vuelve a intentar.');
  }
  
  oauth2Client.setCredentials(tokens);
  
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const email = userInfo.data.email;
  
  if (!email) {
    throw new Error('Could not retrieve email from Google account');
  }
  
  console.log('[Gmail OAuth] Connected email:', email);
  
  const existingConfig = await db.select().from(smtpConfig).where(eq(smtpConfig.id, CONFIG_ID));
  const tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
  
  const oauthData = {
    authMethod: 'oauth' as const,
    oauthAccessToken: tokens.access_token,
    oauthRefreshToken: tokens.refresh_token,
    oauthTokenExpiry: tokenExpiry,
    oauthEmail: email,
    email: email,
    updatedAt: new Date(),
  };
  
  if (existingConfig.length > 0) {
    await db.update(smtpConfig).set(oauthData).where(eq(smtpConfig.id, CONFIG_ID));
  } else {
    await db.insert(smtpConfig).values({
      id: CONFIG_ID,
      ...oauthData,
      host: 'smtp.gmail.com',
      port: 587,
      password: '',
    });
  }
  
  console.log('[Gmail OAuth] Credentials saved to database');
  return { email, success: true };
}

export async function getValidAccessToken(): Promise<{ accessToken: string; email: string } | null> {
  const configs = await db.select().from(smtpConfig).where(eq(smtpConfig.id, CONFIG_ID));
  const config = configs[0];
  
  if (!config) {
    console.log('[Gmail OAuth] No SMTP config found');
    return null;
  }
  
  if (config.authMethod !== 'oauth') {
    console.log('[Gmail OAuth] Auth method is not oauth:', config.authMethod);
    return null;
  }
  
  if (!config.oauthRefreshToken) {
    console.log('[Gmail OAuth] No refresh token stored');
    return null;
  }
  
  const oauth2Client = getOAuth2Client();
  const now = new Date();
  const tokenExpiry = config.oauthTokenExpiry;
  const FIVE_MINUTES = 5 * 60 * 1000;
  const isExpired = !tokenExpiry || (tokenExpiry.getTime() - now.getTime()) < FIVE_MINUTES;
  
  if (isExpired) {
    console.log('[Gmail OAuth] Token expired or expiring soon, refreshing...');
    oauth2Client.setCredentials({ refresh_token: config.oauthRefreshToken });
    
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      console.log('[Gmail OAuth] Token refreshed successfully');
      
      await db.update(smtpConfig).set({
        oauthAccessToken: credentials.access_token,
        oauthTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        updatedAt: new Date(),
      }).where(eq(smtpConfig.id, CONFIG_ID));
      
      return {
        accessToken: credentials.access_token!,
        email: config.oauthEmail || config.email,
      };
    } catch (error: any) {
      console.error('[Gmail OAuth] Failed to refresh token:', error.message);
      if (error.message?.includes('invalid_grant')) {
        console.log('[Gmail OAuth] Token has been revoked, clearing OAuth data');
        await disconnectGmail();
      }
      return null;
    }
  }
  
  return {
    accessToken: config.oauthAccessToken!,
    email: config.oauthEmail || config.email,
  };
}

export async function disconnectGmail(): Promise<void> {
  console.log('[Gmail OAuth] Disconnecting Gmail');
  await db.update(smtpConfig).set({
    authMethod: 'password',
    oauthAccessToken: null,
    oauthRefreshToken: null,
    oauthTokenExpiry: null,
    oauthEmail: null,
    updatedAt: new Date(),
  }).where(eq(smtpConfig.id, CONFIG_ID));
  console.log('[Gmail OAuth] Gmail disconnected successfully');
}

export async function getConnectionStatus(): Promise<{
  connected: boolean;
  oauthAvailable: boolean;
  email: string | null;
  tokenValid: boolean;
  expiresAt: Date | null;
}> {
  const oauthAvailable = isOAuthConfigured();
  
  const configs = await db.select().from(smtpConfig).where(eq(smtpConfig.id, CONFIG_ID));
  const config = configs[0];
  
  if (!config || config.authMethod !== 'oauth' || !config.oauthRefreshToken) {
    return {
      connected: false,
      oauthAvailable,
      email: null,
      tokenValid: false,
      expiresAt: null,
    };
  }
  
  const tokenData = await getValidAccessToken();
  
  return {
    connected: true,
    oauthAvailable,
    email: config.oauthEmail || config.email,
    tokenValid: !!tokenData,
    expiresAt: config.oauthTokenExpiry,
  };
}

export async function testConnection(testEmail?: string): Promise<{
  success: boolean;
  message: string;
  details?: {
    email: string;
    tokenValid: boolean;
    testEmailSent?: boolean;
  };
}> {
  console.log('[Gmail OAuth] Testing connection...');
  
  if (!isOAuthConfigured()) {
    return {
      success: false,
      message: 'Google OAuth no está configurado en el servidor',
    };
  }
  
  const tokenData = await getValidAccessToken();
  
  if (!tokenData) {
    return {
      success: false,
      message: 'Gmail no está conectado o el token ha expirado. Por favor, reconecta tu cuenta.',
    };
  }
  
  if (!testEmail) {
    return {
      success: true,
      message: `Gmail OAuth conectado correctamente como ${tokenData.email}`,
      details: {
        email: tokenData.email,
        tokenValid: true,
      },
    };
  }
  
  console.log('[Gmail OAuth] Sending test email to:', testEmail);
  const result = await sendEmailWithOAuth({
    to: testEmail,
    subject: 'Prueba de conexión Gmail - Panoramica',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #2563eb;">Conexión exitosa</h2>
        <p>Este correo confirma que Gmail OAuth está funcionando correctamente.</p>
        <p><strong>Cuenta conectada:</strong> ${tokenData.email}</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-CL')}</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="color: #6b7280; font-size: 12px;">Este es un mensaje automático de prueba del sistema Panoramica.</p>
      </div>
    `,
  });
  
  if (result.success) {
    return {
      success: true,
      message: `Correo de prueba enviado exitosamente a ${testEmail}`,
      details: {
        email: tokenData.email,
        tokenValid: true,
        testEmailSent: true,
      },
    };
  } else {
    return {
      success: false,
      message: `Error al enviar correo: ${result.error}`,
      details: {
        email: tokenData.email,
        tokenValid: true,
        testEmailSent: false,
      },
    };
  }
}

export async function sendEmailWithOAuth(options: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log('[Gmail OAuth] Sending email to:', options.to);
  
  const tokenData = await getValidAccessToken();
  
  if (!tokenData) {
    const error = 'Gmail OAuth no está conectado o el token expiró';
    console.error('[Gmail OAuth]', error);
    return { success: false, error };
  }
  
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: tokenData.accessToken });
  
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  const fromAddress = options.from || tokenData.email;
  const emailLines = [
    `From: ${fromAddress}`,
    `To: ${options.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(options.subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    options.html,
  ];
  
  const email = emailLines.join('\r\n');
  const encodedEmail = Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  try {
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedEmail },
    });
    
    console.log('[Gmail OAuth] Email sent successfully, messageId:', response.data.id);
    return { success: true, messageId: response.data.id || undefined };
  } catch (error: any) {
    console.error('[Gmail OAuth] Error sending email:', error.message);
    
    let errorMessage = 'Error al enviar correo';
    
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      errorMessage = 'Token de acceso inválido. Por favor, reconecta tu cuenta de Gmail.';
    } else if (error.code === 403) {
      errorMessage = 'Permisos insuficientes. Asegúrate de que la cuenta tiene acceso a Gmail API.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { success: false, error: errorMessage };
  }
}
