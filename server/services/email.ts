import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

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
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(to right, #fd6301, #e55100);
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background-color: #f8fafc;
              padding: 20px;
              border: 1px solid #e2e8f0;
              border-top: none;
              border-radius: 0 0 8px 8px;
            }
            .info-row {
              margin: 10px 0;
              padding: 10px;
              background-color: white;
              border-radius: 4px;
            }
            .label {
              font-weight: bold;
              color: #fd6301;
            }
            .footer {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #e2e8f0;
              font-size: 12px;
              color: #6b7280;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Pinturas Panorámica</h1>
              <p style="margin: 5px 0 0 0;">Nueva Cotización Convertida a Pedido</p>
            </div>
            <div class="content">
              <p>Se ha convertido una cotización a pedido con los siguientes detalles:</p>
              
              <div class="info-row">
                <span class="label">N° Cotización:</span> ${quoteNumber}
              </div>
              
              <div class="info-row">
                <span class="label">Cliente:</span> ${clientName}
              </div>
              
              <div class="info-row">
                <span class="label">Fecha:</span> ${new Date().toLocaleDateString('es-CL', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              
              <p style="margin-top: 20px;">
                Adjunto encontrará el documento PDF de la cotización.
              </p>
              
              <div class="footer">
                <p><strong>Pinturas Panorámica</strong></p>
                <p>Este es un correo automático del sistema de gestión de ventas.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

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
