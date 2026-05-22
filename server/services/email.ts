import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { Resend } from 'resend';
import { wrapEmailContent } from '../email-templates';
import { getValidAccessToken } from '../gmail-oauth';
import { db } from '../db';
import { smtpConfig } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const RESEND_DEFAULT_FROM = 'Panoramica <notificaciones@pinturaspanoramica.cl>';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Normaliza un string de destinatarios que puede traer varias direcciones
// separadas por coma, punto y coma o saltos de línea (común en datos de ERP).
// Soporta el formato "Nombre <correo@dominio.cl>". Descarta cualquier entrada
// que no sea un email válido para no pasarle un `to` malformado a Resend.
function parseRecipients(raw?: string | null): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(/[,;\n\r]+/)) {
    const entry = part.trim();
    if (!entry) continue;
    const angle = entry.match(/<([^>]+)>/);
    const addr = (angle ? angle[1] : entry).trim();
    if (EMAIL_RE.test(addr)) out.push(angle ? entry : addr);
  }
  return out;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  cc?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}

class EmailService {
  private transporter: Transporter | null = null;
  private resend: Resend | null = null;
  private resendFrom: string = RESEND_DEFAULT_FROM;

  constructor() {
    this.initializeTransporter();
    this.initializeResend();
  }

  private initializeResend() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('[email] RESEND_API_KEY no definido — Resend deshabilitado.');
      return;
    }
    try {
      this.resend = new Resend(apiKey);
      if (process.env.RESEND_FROM) {
        this.resendFrom = process.env.RESEND_FROM;
      }
      console.log(`[email] Resend inicializado (from: ${this.resendFrom})`);
    } catch (error) {
      console.error('[email] Error inicializando Resend:', error);
    }
  }

  private initializeTransporter() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
      console.warn('Email service not configured. Missing SMTP environment variables.');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: parseInt(smtpPort) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      console.log('Email service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email service:', error);
    }
  }

  private async createOAuthTransporter(): Promise<Transporter | null> {
    try {
      const tokenInfo = await getValidAccessToken();
      
      if (!tokenInfo) {
        return null;
      }
      
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: tokenInfo.email,
          accessToken: tokenInfo.accessToken,
        },
      });
    } catch (error) {
      console.error('Failed to create OAuth transporter:', error);
      return null;
    }
  }

  private async getDbConfig() {
    try {
      const configs = await db.select().from(smtpConfig).where(eq(smtpConfig.id, 'default'));
      return configs[0] || null;
    } catch (error) {
      console.error('Error fetching SMTP config from DB:', error);
      return null;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const ETAG = '[emailService.sendEmail]';
    console.log(`${ETAG} ▶️ to="${options.to}" cc="${options.cc || ''}" subjectLen=${options.subject.length}`);

    const toList = parseRecipients(options.to);
    const ccList = parseRecipients(options.cc);
    if (toList.length === 0) {
      throw new Error(
        `Destinatario de correo inválido: "${(options.to ?? '').trim()}". Revisa el email del cliente (formato esperado: nombre@dominio.cl).`,
      );
    }
    const toStr = toList.join(', ');
    const ccStr = ccList.length ? ccList.join(', ') : undefined;

    // Prefer Resend when configured — much more reliable than SMTP/OAuth.
    if (this.resend) {
      try {
        const fromAddress = options.from || this.resendFrom;
        console.log(`${ETAG} usando Resend`, { from: fromAddress, to: toList, cc: ccStr, replyTo: options.replyTo });
        const { data, error } = await this.resend.emails.send({
          from: fromAddress,
          to: toList,
          cc: ccList.length ? ccList : undefined,
          replyTo: options.replyTo,
          subject: options.subject,
          html: options.html,
          attachments: options.attachments?.map(a => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
          })),
        });
        if (error) {
          console.error(`${ETAG} ❌ Resend error:`, error);
          throw new Error((error as any)?.message || 'Error de Resend al enviar correo');
        }
        console.log(`${ETAG} ✅ enviado vía Resend:`, data?.id);
        return true;
      } catch (error: any) {
        console.error(`${ETAG} ❌ Error Resend:`, {
          message: error?.message,
          name: error?.name,
          stack: error?.stack,
        });
        throw error;
      }
    }

    // Try OAuth first
    const config = await this.getDbConfig();
    console.log(`${ETAG} dbConfig`, config ? {
      id: (config as any).id,
      authMethod: config.authMethod,
      host: config.host,
      port: config.port,
      hasEmail: !!config.email,
      hasPassword: !!config.password,
      fromName: config.fromName,
    } : null);

    if (config?.authMethod === 'oauth') {
      console.log(`${ETAG} intentando OAuth...`);
      const oauthTransporter = await this.createOAuthTransporter();

      if (oauthTransporter) {
        try {
          const tokenInfo = await getValidAccessToken();
          console.log(`${ETAG} OAuth tokenInfo`, { hasToken: !!tokenInfo, email: tokenInfo?.email });
          const info = await oauthTransporter.sendMail({
            from: options.from || (config.fromName ? `"${config.fromName}" <${tokenInfo?.email}>` : tokenInfo?.email),
            to: toStr,
            cc: ccStr,
            replyTo: options.replyTo || undefined,
            subject: options.subject,
            html: options.html,
            attachments: options.attachments,
          });

          console.log(`${ETAG} ✅ enviado vía OAuth:`, info.messageId);
          return true;
        } catch (error: any) {
          console.error(`${ETAG} ❌ Error OAuth:`, {
            message: error?.message,
            name: error?.name,
            code: error?.code,
            response: error?.response,
            responseCode: error?.responseCode,
            command: error?.command,
            stack: error?.stack,
          });
          throw error;
        }
      } else {
        console.warn(`${ETAG} ⚠️ OAuth configurado pero no se pudo crear transporter (token inválido?)`);
      }
    }

    // Fallback to password auth from DB config
    if (config?.authMethod === 'password' && config.email && config.password) {
      console.log(`${ETAG} usando password auth desde DB`, { host: config.host, port: config.port, user: config.email });
      try {
        const dbTransporter = nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.port === 465,
          auth: {
            user: config.email,
            pass: config.password,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });

        const fromAddress = options.from || (config.fromName
          ? `"${config.fromName}" <${config.email}>`
          : config.email);

        const info = await dbTransporter.sendMail({
          from: fromAddress,
          to: toStr,
          cc: ccStr,
          replyTo: options.replyTo || undefined,
          subject: options.subject,
          html: options.html,
          attachments: options.attachments,
        });

        console.log(`${ETAG} ✅ enviado vía password auth (DB):`, info.messageId);
        return true;
      } catch (error: any) {
        console.error(`${ETAG} ❌ Error password auth (DB):`, {
          message: error?.message,
          name: error?.name,
          code: error?.code,
          response: error?.response,
          responseCode: error?.responseCode,
          command: error?.command,
          stack: error?.stack,
        });
        throw error;
      }
    }

    // Fallback to environment variables
    if (!this.transporter) {
      console.error(`${ETAG} ❌ no hay transporter SMTP por env y dbConfig=${config?.authMethod || 'null'}`);
      throw new Error('Email service not configured. Please configure SMTP or connect Gmail via OAuth.');
    }

    console.log(`${ETAG} usando transporter SMTP por env (SMTP_HOST=${process.env.SMTP_HOST})`);
    try {
      const info = await this.transporter.sendMail({
        from: options.from || process.env.SMTP_USER,
        to: toStr,
        cc: ccStr,
        replyTo: options.replyTo || undefined,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
      });

      console.log(`${ETAG} ✅ enviado vía env SMTP:`, info.messageId);
      return true;
    } catch (error: any) {
      console.error(`${ETAG} ❌ Error env SMTP:`, {
        message: error?.message,
        name: error?.name,
        code: error?.code,
        response: error?.response,
        responseCode: error?.responseCode,
        command: error?.command,
        stack: error?.stack,
      });
      throw error;
    }
  }

  async sendQuoteEmail(
    quoteNumber: string,
    clientName: string,
    pdfBuffer: Buffer,
    recipientEmail: string = 'contacto@pinturaspanoramica.cl'
  ): Promise<boolean> {
    const subject = `Nueva Cotización Convertida a Pedido - ${quoteNumber}`;
    const html = wrapEmailContent(`
      <h2 style="color: #1a1f2e; margin: 0 0 20px 0; font-family: Arial, sans-serif;">
        Nueva Cotización Convertida a Pedido
      </h2>
      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Se ha convertido una cotización a pedido con los siguientes detalles:
      </p>
      
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 20px;">
        <tr>
          <td style="padding: 12px; background-color: #f8f9fa; border-radius: 4px; margin-bottom: 8px;">
            <span style="font-weight: bold; color: #fd6301;">N° Cotización:</span>
            <span style="color: #333; margin-left: 8px;">${quoteNumber}</span>
          </td>
        </tr>
        <tr><td style="height: 8px;"></td></tr>
        <tr>
          <td style="padding: 12px; background-color: #f8f9fa; border-radius: 4px;">
            <span style="font-weight: bold; color: #fd6301;">Cliente:</span>
            <span style="color: #333; margin-left: 8px;">${clientName}</span>
          </td>
        </tr>
        <tr><td style="height: 8px;"></td></tr>
        <tr>
          <td style="padding: 12px; background-color: #f8f9fa; border-radius: 4px;">
            <span style="font-weight: bold; color: #fd6301;">Fecha:</span>
            <span style="color: #333; margin-left: 8px;">${new Date().toLocaleDateString('es-CL', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</span>
          </td>
        </tr>
      </table>
      
      <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="color: #1565c0; margin: 0; font-size: 14px;">
          📎 Adjunto encontrará el documento PDF de la cotización.
        </p>
      </div>
    `);

    return this.sendEmail({
      to: recipientEmail,
      subject,
      html,
      attachments: [
        {
          filename: `Cotizacion_${quoteNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  /**
   * Checks if ANY email sending method is configured (OAuth, DB password, or env vars).
   * Use this instead of isConfigured() when deciding whether to allow email sending.
   */
  async isAnyMethodConfigured(): Promise<boolean> {
    // Resend
    if (this.resend !== null) return true;
    // Check env vars transporter
    if (this.transporter !== null) return true;
    
    // Check DB config (OAuth or password)
    try {
      const config = await this.getDbConfig();
      if (config?.authMethod === 'oauth') {
        const tokenInfo = await getValidAccessToken();
        return !!tokenInfo;
      }
      if (config?.authMethod === 'password' && config.email && config.password) {
        return true;
      }
    } catch (error) {
      console.error('Error checking email configuration:', error);
    }
    
    return false;
  }
}

export const emailService = new EmailService();
