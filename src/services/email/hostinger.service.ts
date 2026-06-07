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

export type SendEnquiryAdminNotificationParams = {
  to: string;
  enquiryId: string;
  referenceNumber: string;
  serviceType: string;
  status: string;
  source: string;
  isPriority: boolean;
  submittedAt: string;
  contact: {
    fullName: string;
    mobile: string;
    email: string;
    callbackRequested: boolean;
  };
  serviceDetails: Record<string, unknown>;
  estimatedInrValue?: number;
  fxRateUsed?: number;
};

@Injectable()
export class HostingerService {
  private readonly logger = new Logger(HostingerService.name);
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

  async sendEnquiryAdminNotification(
    params: SendEnquiryAdminNotificationParams,
  ): Promise<void> {
    const priorityLabel = params.isPriority ? ' (PRIORITY)' : '';
    const subject = `New enquiry received${priorityLabel}: ${params.serviceType} — ${params.referenceNumber}`;
    const text = this.buildEnquiryAdminNotificationText(params);
    const html = this.buildEnquiryAdminNotificationHtml(params);

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

  private buildEnquiryAdminNotificationText(
    params: SendEnquiryAdminNotificationParams,
  ): string {
    const lines = [
      'A new service enquiry has been submitted.',
      '',
      'Enquiry Summary',
      `Enquiry ID: ${params.enquiryId}`,
      `Reference: ${params.referenceNumber}`,
      `Service: ${params.serviceType}`,
      `Status: ${params.status}`,
      `Source: ${params.source}`,
      `Priority: ${params.isPriority ? 'Yes' : 'No'}`,
      `Submitted At: ${params.submittedAt}`,
      '',
      'Contact Information',
      `Full Name: ${params.contact.fullName}`,
      `Mobile: ${params.contact.mobile}`,
      `Email: ${params.contact.email}`,
      `Callback Requested: ${params.contact.callbackRequested ? 'Yes' : 'No'}`,
      '',
      'Service Details',
      ...this.formatDetailLines(params.serviceDetails),
    ];

    if (params.estimatedInrValue != null) {
      lines.push(`Estimated INR Value: ${params.estimatedInrValue}`);
    }

    if (params.fxRateUsed != null) {
      lines.push(`FX Rate Used: ${params.fxRateUsed}`);
    }

    return lines.join('\n');
  }

  private buildEnquiryAdminNotificationHtml(
    params: SendEnquiryAdminNotificationParams,
  ): string {
    const summaryRows: [string, string][] = [
      ['Enquiry ID', params.enquiryId],
      ['Reference', params.referenceNumber],
      ['Service', params.serviceType],
      ['Status', params.status],
      ['Source', params.source],
      ['Priority', params.isPriority ? 'Yes' : 'No'],
      ['Submitted At', params.submittedAt],
    ];

    const contactRows: [string, string][] = [
      ['Full Name', params.contact.fullName],
      ['Mobile', params.contact.mobile],
      ['Email', params.contact.email],
      [
        'Callback Requested',
        params.contact.callbackRequested ? 'Yes' : 'No',
      ],
    ];

    const detailRows: [string, string][] = Object.entries(
      params.serviceDetails,
    ).map(([key, value]) => [
      this.formatFieldLabel(key),
      this.formatFieldValue(value),
    ]);

    if (params.estimatedInrValue != null) {
      detailRows.push([
        'Estimated INR Value',
        this.formatFieldValue(params.estimatedInrValue),
      ]);
    }

    if (params.fxRateUsed != null) {
      detailRows.push(['FX Rate Used', this.formatFieldValue(params.fxRateUsed)]);
    }

    return `
<!DOCTYPE html>
<html lang="en">
  <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; margin: 0; padding: 0;">
    <div style="max-width: 640px; margin: 0 auto; padding: 24px;">
      <h2 style="margin: 0 0 16px;">New Service Enquiry</h2>
      <p style="margin: 0 0 24px;">A new enquiry has been submitted and saved to the database.</p>
      ${this.buildDetailsSectionHtml('Enquiry Summary', summaryRows)}
      ${this.buildDetailsSectionHtml('Contact Information', contactRows)}
      ${this.buildDetailsSectionHtml('Service Details', detailRows)}
    </div>
  </body>
</html>`.trim();
  }

  private buildDetailsSectionHtml(
    title: string,
    rows: [string, string][],
  ): string {
    const tableRows = rows
      .map(
        ([label, value]) => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; width: 40%; vertical-align: top;">
            ${this.escapeHtml(label)}
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
            ${this.escapeHtml(value)}
          </td>
        </tr>`,
      )
      .join('');

    return `
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 8px; font-size: 16px;">${this.escapeHtml(title)}</h3>
        <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px; overflow: hidden;">
          ${tableRows}
        </table>
      </div>`;
  }

  private formatDetailLines(
    details: Record<string, unknown>,
  ): string[] {
    return Object.entries(details).map(
      ([key, value]) =>
        `${this.formatFieldLabel(key)}: ${this.formatFieldValue(value)}`,
    );
  }

  private formatFieldLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (char) => char.toUpperCase())
      .trim();
  }

  private formatFieldValue(value: unknown): string {
    if (value == null) {
      return '—';
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (typeof value === 'number') {
      return Number.isInteger(value)
        ? value.toLocaleString('en-IN')
        : value.toLocaleString('en-IN', { maximumFractionDigits: 4 });
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
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
