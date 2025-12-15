import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { wrapEmailContent } from '../email-templates';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}

class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initializeTransporter();
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

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      throw new Error('Email service not configured. Please set SMTP environment variables.');
    }

    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_USER,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
      });

      console.log('Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
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
}

export const emailService = new EmailService();
