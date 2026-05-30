import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import { AppConfigService } from 'src/services/env/env.service';

export type SendEnquiryConfirmationParams = {
  to: string;
  fullName: string;
  serviceType: string;
  referenceNumber: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: AppConfigService) {}

  async sendEnquiryConfirmation(
    params: SendEnquiryConfirmationParams,
  ): Promise<void> {
    const subject = 'Your enquiry has been received';
    const text = this.buildEnquiryConfirmationText(params);
    const html = this.buildEnquiryConfirmationHtml(params);

    await this.sendMail({
      to: params.to,
      subject,
      text,
      html,
    });
  }

  private async sendMail(options: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    const activeMode = this.config.get('SMTP_ACTIVE_MODE');
    const from = this.config.get('SMTP_FROM');

    if (activeMode !== 'true') {
      this.logger.warn(
        `SMTP_ACTIVE_MODE is not "true"; skipping email send. to=${options.to} subject="${options.subject}"`,
      );
      this.logger.debug(`Email dry-run text: ${options.text}`);
      return;
    }

    if (!from?.trim()) {
      this.logger.error('SMTP is active but SMTP_FROM is missing.');
      throw new InternalServerErrorException(
        'Email provider is not configured correctly.',
      );
    }

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      this.logger.log(`Email sent to ${options.to}: "${options.subject}"`);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email via SMTP: ${detail}`);
      throw new InternalServerErrorException(
        'Unable to send email right now. Please try again later.',
      );
    }
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.config.get('SMTP_HOST');
    const portRaw = this.config.get('SMTP_PORT');
    const user = this.config.get('SMTP_USER');
    const pass = this.config.get('SMTP_PASS');

    if (!host?.trim() || !portRaw?.trim() || !user?.trim() || !pass?.trim()) {
      this.logger.error(
        'SMTP is active but SMTP_HOST, SMTP_PORT, SMTP_USER, or SMTP_PASS is missing.',
      );
      throw new InternalServerErrorException(
        'Email provider is not configured correctly.',
      );
    }

    const port = Number(portRaw);
    if (!Number.isFinite(port) || port <= 0) {
      throw new InternalServerErrorException(
        'SMTP_PORT must be a valid positive number.',
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    return this.transporter;
  }

  private buildEnquiryConfirmationText(
    params: SendEnquiryConfirmationParams,
  ): string {
    return [
      `Dear ${params.fullName},`,
      '',
      'Thank you for reaching out to us.',
      '',
      'Your query has been saved successfully. Our team will contact you within one day.',
      '',
      `Service: ${params.serviceType}`,
      `Reference: ${params.referenceNumber}`,
      '',
      'Best regards,',
      'FinPay Team',
    ].join('\n');
  }

  private buildEnquiryConfirmationHtml(
    params: SendEnquiryConfirmationParams,
  ): string {
    return `
<!DOCTYPE html>
<html lang="en">
  <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; margin: 0; padding: 0;">
    <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
      <p>Dear ${this.escapeHtml(params.fullName)},</p>
      <p>Thank you for reaching out to us.</p>
      <p>
        Your query has been saved successfully. Our team will contact you
        <strong>within 2 business hours.</strong>.
      </p>
      <p style="background: #f3f4f6; padding: 16px; border-radius: 8px;">
        <strong>Service:</strong> ${this.escapeHtml(params.serviceType)}<br />
        <strong>Reference:</strong> ${this.escapeHtml(params.referenceNumber)}
      </p>
      <p>Best regards,<br />FinPay Team</p>
    </div>
  </body>
</html>`.trim();
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
