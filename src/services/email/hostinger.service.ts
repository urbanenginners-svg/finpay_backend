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

export type SendAgentRegistrationConfirmationParams = {
  to: string;
  fullName: string;
  agentTypeLabel: string;
  userId: string;
  submittedAt: string;
};

export type SendAgentRegistrationAdminNotificationParams = {
  to: string;
  userId: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  agentTypeLabel: string;
  submittedAt: string;
  documentsUploaded: number;
  requiredDocumentsUploaded: number;
  totalRequiredDocuments: number;
  reviewUrl: string;
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

  async sendForexOrderApproved(params: {
    to: string;
    fullName: string;
    orderRef: string;
    paymentLink: string;
  }): Promise<void> {
    const subject = `Your forex documents are verified — ${params.orderRef}`;
    const text = [
      `Dear ${params.fullName},`,
      '',
      'Your documents are verified.',
      '',
      `Order: ${params.orderRef}`,
      '',
      'Please make payment using this FinPay link (you will be redirected to payment):',
      params.paymentLink,
      '',
      'Best regards,',
      'FinPay Team',
    ].join('\n');
    const html = `
<!DOCTYPE html>
<html lang="en">
  <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; margin: 0; padding: 0;">
    <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
      <p>Dear ${this.escapeHtml(params.fullName)},</p>
      <p>Your documents are verified.</p>
      <p style="background: #f3f4f6; padding: 16px; border-radius: 8px;">
        <strong>Order:</strong> ${this.escapeHtml(params.orderRef)}
      </p>
      <p>Please make payment to complete this booking.</p>
      <p style="margin: 24px 0;">
        <a
          href="${this.escapeHtml(params.paymentLink)}"
          style="display: inline-block; background: #1e3a5f; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;"
        >
          Pay now
        </a>
      </p>
      <p style="font-size: 13px; color: #6b7280; word-break: break-all;">
        Or open this FinPay link (you will be redirected to payment):<br />
        <a href="${this.escapeHtml(params.paymentLink)}">${this.escapeHtml(params.paymentLink)}</a>
      </p>
      <p>Best regards,<br />FinPay Team</p>
    </div>
  </body>
</html>`.trim();

    await this.sendMail({ to: params.to, subject, text, html });
  }

  async sendForexOrderStatusUpdate(params: {
    to: string;
    fullName: string;
    orderRef: string;
    status: string;
    statusLabel: string;
  }): Promise<void> {
    const subject = `Forex order ${params.orderRef} status: ${params.statusLabel}`;
    const text = [
      `Dear ${params.fullName},`,
      '',
      `The status of your forex order ${params.orderRef} has been updated.`,
      '',
      `Status: ${params.statusLabel} (${params.status})`,
      '',
      'You can check the latest details in your FinPay dashboard.',
      '',
      'Best regards,',
      'FinPay Team',
    ].join('\n');
    const html = `
<!DOCTYPE html>
<html lang="en">
  <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; margin: 0; padding: 0;">
    <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
      <p>Dear ${this.escapeHtml(params.fullName)},</p>
      <p>
        The status of your forex order
        <strong>${this.escapeHtml(params.orderRef)}</strong> has been updated.
      </p>
      <p style="background: #f3f4f6; padding: 16px; border-radius: 8px;">
        <strong>Status:</strong> ${this.escapeHtml(params.statusLabel)}
        (${this.escapeHtml(params.status)})
      </p>
      <p>You can check the latest details in your FinPay dashboard.</p>
      <p>Best regards,<br />FinPay Team</p>
    </div>
  </body>
</html>`.trim();

    await this.sendMail({ to: params.to, subject, text, html });
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

  async sendAgentRegistrationConfirmation(
    params: SendAgentRegistrationConfirmationParams,
  ): Promise<void> {
    const subject = 'Welcome to FinPay — Agent registration received';
    const text = this.buildAgentRegistrationConfirmationText(params);
    const html = this.buildAgentRegistrationConfirmationHtml(params);

    await this.sendMail({ to: params.to, subject, text, html });
  }

  async sendAgentRegistrationAdminNotification(
    params: SendAgentRegistrationAdminNotificationParams,
  ): Promise<void> {
    const subject = `New agent registration — ${params.agentTypeLabel} — ${params.fullName}`;
    const text = this.buildAgentRegistrationAdminNotificationText(params);
    const html = this.buildAgentRegistrationAdminNotificationHtml(params);

    await this.sendMail({ to: params.to, subject, text, html });
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

  private buildAgentRegistrationConfirmationText(
    params: SendAgentRegistrationConfirmationParams,
  ): string {
    return [
      `Dear ${params.fullName},`,
      '',
      'Thank you for signing up as a FinPay partner agent.',
      '',
      'We have received your registration and documents. Our team is reviewing your application.',
      '',
      `Agent type: ${params.agentTypeLabel}`,
      `Reference ID: ${params.userId}`,
      `Submitted: ${params.submittedAt}`,
      '',
      'What happens next?',
      '• Our compliance team will verify your documents',
      '• You will receive an email once your account is approved',
      '• After approval, you can sign in and start partnering with FinPay',
      '',
      'Best regards,',
      'FinPay Team',
    ].join('\n');
  }

  private buildAgentRegistrationConfirmationHtml(
    params: SendAgentRegistrationConfirmationParams,
  ): string {
    const content = `
      <p style="margin: 0 0 16px; font-size: 16px; color: #111827;">
        Dear ${this.escapeHtml(params.fullName)},
      </p>
      <p style="margin: 0 0 16px; color: #374151;">
        Thank you for signing up as a <strong>FinPay partner agent</strong>.
        We have received your registration and documents.
      </p>
      <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
        <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #5b21b6; text-transform: uppercase; letter-spacing: 0.04em;">
          Registration summary
        </p>
        <p style="margin: 0 0 6px; color: #374151;"><strong>Agent type:</strong> ${this.escapeHtml(params.agentTypeLabel)}</p>
        <p style="margin: 0 0 6px; color: #374151;"><strong>Reference ID:</strong> ${this.escapeHtml(params.userId)}</p>
        <p style="margin: 0; color: #374151;"><strong>Submitted:</strong> ${this.escapeHtml(params.submittedAt)}</p>
      </div>
      <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
        <p style="margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #9a3412;">
          Pending admin verification
        </p>
        <ul style="margin: 0; padding-left: 20px; color: #374151;">
          <li style="margin-bottom: 8px;">Our compliance team will verify your documents</li>
          <li style="margin-bottom: 8px;">You will receive an email once your account is approved</li>
          <li>After approval, you can sign in and start partnering with FinPay</li>
        </ul>
      </div>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        Best regards,<br />
        <strong style="color: #5b21b6;">FinPay Team</strong>
      </p>`;

    return this.buildFinPayEmailShell({
      badge: 'Partner Agent',
      title: 'Registration received',
      subtitle: 'Your application is under review',
      content,
    });
  }

  private buildAgentRegistrationAdminNotificationText(
    params: SendAgentRegistrationAdminNotificationParams,
  ): string {
    return [
      'A new partner agent registration has been submitted.',
      '',
      'Agent Details',
      `User ID: ${params.userId}`,
      `Name: ${params.fullName}`,
      `Email: ${params.email}`,
      `Phone: ${params.phoneNumber ?? '—'}`,
      `Agent Type: ${params.agentTypeLabel}`,
      `Submitted At: ${params.submittedAt}`,
      `Documents: ${params.requiredDocumentsUploaded}/${params.totalRequiredDocuments} required uploaded (${params.documentsUploaded} total)`,
      '',
      `Review in admin: ${params.reviewUrl}`,
    ].join('\n');
  }

  private buildAgentRegistrationAdminNotificationHtml(
    params: SendAgentRegistrationAdminNotificationParams,
  ): string {
    const summaryRows: [string, string][] = [
      ['User ID', params.userId],
      ['Name', params.fullName],
      ['Email', params.email],
      ['Phone', params.phoneNumber ?? '—'],
      ['Agent Type', params.agentTypeLabel],
      ['Submitted At', params.submittedAt],
      [
        'Documents',
        `${params.requiredDocumentsUploaded}/${params.totalRequiredDocuments} required uploaded (${params.documentsUploaded} total)`,
      ],
      ['Status', 'Pending admin verification'],
    ];

    const content = `
      <p style="margin: 0 0 16px; color: #374151;">
        A new partner agent has completed registration and is waiting for your review.
      </p>
      ${this.buildDetailsSectionHtml('Registration Summary', summaryRows)}
      <p style="margin: 24px 0 0;">
        <a
          href="${this.escapeHtml(params.reviewUrl)}"
          style="display: inline-block; background: #5b21b6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; font-size: 14px;"
        >
          Review agent in admin
        </a>
      </p>
      <p style="margin: 16px 0 0; font-size: 13px; color: #6b7280; word-break: break-all;">
        Or open: <a href="${this.escapeHtml(params.reviewUrl)}" style="color: #5b21b6;">${this.escapeHtml(params.reviewUrl)}</a>
      </p>`;

    return this.buildFinPayEmailShell({
      badge: 'Admin Alert',
      title: 'New agent registration',
      subtitle: params.fullName,
      content,
    });
  }

  private buildFinPayEmailShell(params: {
    badge: string;
    title: string;
    subtitle?: string;
    content: string;
  }): string {
    return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${this.escapeHtml(params.title)}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #f5f3ff; font-family: Inter, Arial, sans-serif; color: #1f2937; line-height: 1.6;">
    <div style="max-width: 640px; margin: 0 auto; padding: 32px 16px;">
      <div style="background: linear-gradient(135deg, #5b21b6 0%, #6d28d9 100%); border-radius: 16px 16px 0 0; padding: 28px 32px; text-align: center;">
        <div style="color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.03em; font-family: 'Space Grotesk', Inter, Arial, sans-serif;">
          FinPay
        </div>
        <div style="display: inline-block; margin-top: 14px; background: #f97316; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 6px 14px; border-radius: 999px;">
          ${this.escapeHtml(params.badge)}
        </div>
        <h1 style="margin: 18px 0 0; color: #ffffff; font-size: 22px; font-weight: 700; line-height: 1.3;">
          ${this.escapeHtml(params.title)}
        </h1>
        ${
          params.subtitle
            ? `<p style="margin: 8px 0 0; color: #ede9fe; font-size: 14px;">${this.escapeHtml(params.subtitle)}</p>`
            : ''
        }
      </div>
      <div style="background: #ffffff; border: 1px solid #ede9fe; border-top: none; border-radius: 0 0 16px 16px; padding: 32px; box-shadow: 0 10px 30px rgba(91, 33, 182, 0.08);">
        ${params.content}
      </div>
      <p style="text-align: center; color: #9ca3af; font-size: 12px; margin: 24px 0 0;">
        © FinPay · Secure remittance &amp; forex services
      </p>
    </div>
  </body>
</html>`.trim();
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
