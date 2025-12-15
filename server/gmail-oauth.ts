import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { db } from './db';
import { smtpConfig } from '../shared/schema';
import { eq } from 'drizzle-orm';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }
  
  // Priority: Custom domain env var > Dev domain > Replit domains > localhost
  let redirectUri: string;
  if (process.env.GMAIL_OAUTH_REDIRECT_URI) {
    redirectUri = process.env.GMAIL_OAUTH_REDIRECT_URI;
  } else if (process.env.REPLIT_DEV_DOMAIN) {
    redirectUri = `https://${process.env.REPLIT_DEV_DOMAIN}/api/oauth/google/callback`;
  } else if (process.env.REPLIT_DOMAINS) {
    redirectUri = `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/api/oauth/google/callback`;
  } else {
    redirectUri = 'http://localhost:5000/api/oauth/google/callback';
  }
  
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

import crypto from 'crypto';

// Store state tokens for CSRF protection (in production, use session storage)
const stateTokens = new Map<string, { timestamp: number }>();

// Clean up expired state tokens (5 minutes expiry)
function cleanupStateTokens() {
  const now = Date.now();
  for (const [token, data] of stateTokens.entries()) {
    if (now - data.timestamp > 5 * 60 * 1000) {
      stateTokens.delete(token);
    }
  }
}

export function getAuthUrl(): { url: string; state: string } {
  const oauth2Client = getOAuth2Client();
  
  // Generate cryptographically random state token for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  
  // Store state token with timestamp
  cleanupStateTokens();
  stateTokens.set(state, { timestamp: Date.now() });
  
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: state,
  });
  
  return { url, state };
}

export function validateStateToken(state: string): boolean {
  cleanupStateTokens();
  
  if (!state || !stateTokens.has(state)) {
    return false;
  }
  
  // Remove the token after validation (one-time use)
  stateTokens.delete(state);
  return true;
}

export async function handleCallback(code: string): Promise<{ email: string; success: boolean }> {
  const oauth2Client = getOAuth2Client();
  
  const { tokens } = await oauth2Client.getToken(code);
  
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to obtain tokens');
  }
  
  oauth2Client.setCredentials(tokens);
  
  // Get user email
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const email = userInfo.data.email;
  
  if (!email) {
    throw new Error('Failed to get user email');
  }
  
  // Save tokens to database
  const existingConfig = await db.select().from(smtpConfig).where(eq(smtpConfig.id, 'default'));
  
  const tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
  
  if (existingConfig.length > 0) {
    await db.update(smtpConfig)
      .set({
        authMethod: 'oauth',
        oauthAccessToken: tokens.access_token,
        oauthRefreshToken: tokens.refresh_token,
        oauthTokenExpiry: tokenExpiry,
        oauthEmail: email,
        email: email,
        updatedAt: new Date(),
      })
      .where(eq(smtpConfig.id, 'default'));
  } else {
    await db.insert(smtpConfig).values({
      id: 'default',
      authMethod: 'oauth',
      oauthAccessToken: tokens.access_token,
      oauthRefreshToken: tokens.refresh_token,
      oauthTokenExpiry: tokenExpiry,
      oauthEmail: email,
      email: email,
      host: 'smtp.gmail.com',
      port: 587,
      password: '',
    });
  }
  
  return { email, success: true };
}

export async function getValidAccessToken(): Promise<{ accessToken: string; email: string } | null> {
  const configs = await db.select().from(smtpConfig).where(eq(smtpConfig.id, 'default'));
  const config = configs[0];
  
  if (!config || config.authMethod !== 'oauth' || !config.oauthRefreshToken) {
    return null;
  }
  
  const oauth2Client = getOAuth2Client();
  
  // Check if token is expired or about to expire (within 5 minutes)
  const now = new Date();
  const tokenExpiry = config.oauthTokenExpiry;
  const isExpired = !tokenExpiry || tokenExpiry.getTime() - now.getTime() < 5 * 60 * 1000;
  
  if (isExpired) {
    // Refresh the token
    oauth2Client.setCredentials({
      refresh_token: config.oauthRefreshToken,
    });
    
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update tokens in database
      await db.update(smtpConfig)
        .set({
          oauthAccessToken: credentials.access_token,
          oauthTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
          updatedAt: new Date(),
        })
        .where(eq(smtpConfig.id, 'default'));
      
      return {
        accessToken: credentials.access_token!,
        email: config.oauthEmail || config.email,
      };
    } catch (error) {
      console.error('Failed to refresh OAuth token:', error);
      return null;
    }
  }
  
  return {
    accessToken: config.oauthAccessToken!,
    email: config.oauthEmail || config.email,
  };
}

export async function disconnectGmail(): Promise<void> {
  await db.update(smtpConfig)
    .set({
      authMethod: 'password',
      oauthAccessToken: null,
      oauthRefreshToken: null,
      oauthTokenExpiry: null,
      oauthEmail: null,
      updatedAt: new Date(),
    })
    .where(eq(smtpConfig.id, 'default'));
}

export function isOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

export async function sendEmailWithOAuth(options: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const tokenData = await getValidAccessToken();
  
  if (!tokenData) {
    return { success: false, error: 'Gmail OAuth no está conectado o el token expiró' };
  }
  
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: tokenData.accessToken });
  
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  // Build the email
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
      requestBody: {
        raw: encodedEmail,
      },
    });
    
    return { success: true, messageId: response.data.id || undefined };
  } catch (error: any) {
    console.error('Error sending email via Gmail OAuth:', error);
    return { success: false, error: error.message || 'Error al enviar correo' };
  }
}
