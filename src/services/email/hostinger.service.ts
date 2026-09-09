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

export type SendAgentDocumentUpdateRequestParams = {
  to: string;
  fullName: string;
  message?: string;
  uploadUrl: string;
  items: {
    label: string;
    requestType: 'update' | 'additional';
    adminNote?: string;
  }[];
};

export type SendAgentAccountCreatedByAdminParams = {
  to: string;
  fullName: string;
  email: string;
  temporaryPassword: string;
  agentTypeLabel: string;
  loginUrl: string;
};

export type AgentDocumentRequestItem = {
  label: string;
  requestType: 'update' | 'additional';
  adminNote?: string;
};

export type AgentReviewAction =
  | 'approved'
  | 'rejected'
  | 'documents_requested';

export type SendAgentApprovedParams = {
  to: string;
  fullName: string;
  agentTypeLabel: string;
  userId: string;
  loginUrl: string;
};

export type SendAgentRejectedParams = {
  to: string;
  fullName: string;
  agentTypeLabel: string;
  userId: string;
  rejectionReason: string;
};

export type SendAgentReviewAdminNotificationParams = {
  to: string;
  action: AgentReviewAction;
  userId: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  agentTypeLabel: string;
  actedAt: string;
  reviewUrl: string;
  rejectionReason?: string;
  message?: string;
  documentItems?: AgentDocumentRequestItem[];
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

  async sendAgentDocumentUpdateRequest(
    params: SendAgentDocumentUpdateRequestParams,
  ): Promise<void> {
    const subject = 'Action required — Please update your FinPay agent documents';
    const text = this.buildAgentDocumentUpdateRequestText(params);
    const html = this.buildAgentDocumentUpdateRequestHtml(params);

    await this.sendMail({ to: params.to, subject, text, html });
  }

  async sendAgentAccountCreatedByAdmin(
    params: SendAgentAccountCreatedByAdminParams,
  ): Promise<void> {
    const subject = 'Your FinPay agent account is ready';
    const text = this.buildAgentAccountCreatedByAdminText(params);
    const html = this.buildAgentAccountCreatedByAdminHtml(params);

    await this.sendMail({ to: params.to, subject, text, html });
  }

  async sendAgentApproved(params: SendAgentApprovedParams): Promise<void> {
    const subject = 'Your FinPay agent account is approved';
    const text = this.buildAgentApprovedText(params);
    const html = this.buildAgentApprovedHtml(params);

    await this.sendMail({ to: params.to, subject, text, html });
  }

  async sendAgentRejected(params: SendAgentRejectedParams): Promise<void> {
    const subject = 'Update on your FinPay agent registration';
    const text = this.buildAgentRejectedText(params);
    const html = this.buildAgentRejectedHtml(params);

    await this.sendMail({ to: params.to, subject, text, html });
  }

  async sendAgentReviewAdminNotification(
    params: SendAgentReviewAdminNotificationParams,
  ): Promise<void> {
    const subjectByAction: Record<AgentReviewAction, string> = {
      approved: `Agent approved — ${params.agentTypeLabel} — ${params.fullName}`,
      rejected: `Agent registration rejected — ${params.fullName}`,
      documents_requested: `Document update requested — ${params.fullName}`,
    };

    await this.sendMail({
      to: params.to,
      subject: subjectByAction[params.action],
      text: this.buildAgentReviewAdminNotificationText(params),
      html: this.buildAgentReviewAdminNotificationHtml(params),
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

  private buildAgentDocumentUpdateRequestText(
    params: SendAgentDocumentUpdateRequestParams,
  ): string {
    const lines = [
      `Dear ${params.fullName},`,
      '',
      'Our team has reviewed your agent registration and needs a few document updates before we can approve your account.',
      '',
    ];

    if (params.message?.trim()) {
      lines.push('Message from FinPay team:', params.message.trim(), '');
    }

    lines.push('Documents requested:');
    for (const item of params.items) {
      const typeLabel = item.requestType === 'update' ? 'Re-upload' : 'Additional document';
      lines.push(`• [${typeLabel}] ${item.label}`);
      if (item.adminNote?.trim()) {
        lines.push(`  Note: ${item.adminNote.trim()}`);
      }
    }

    lines.push('', `Upload documents: ${params.uploadUrl}`, '', 'Best regards,', 'FinPay Team');
    return lines.join('\n');
  }

  private buildAgentDocumentUpdateRequestHtml(
    params: SendAgentDocumentUpdateRequestParams,
  ): string {
    const itemRows = params.items
      .map((item) => {
        const typeLabel = item.requestType === 'update' ? 'Re-upload required' : 'Additional document';
        const typeColor = item.requestType === 'update' ? '#9a3412' : '#5b21b6';
        const note = item.adminNote?.trim()
          ? `<p style="margin: 8px 0 0; font-size: 13px; color: #6b7280;"><strong>Note:</strong> ${this.escapeHtml(item.adminNote.trim())}</p>`
          : '';

        return `
          <div style="border: 1px solid #ede9fe; border-radius: 12px; padding: 16px; margin-bottom: 12px; background: #fafafa;">
            <span style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: ${typeColor}; margin-bottom: 8px;">
              ${this.escapeHtml(typeLabel)}
            </span>
            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #111827;">
              ${this.escapeHtml(item.label)}
            </p>
            ${note}
          </div>`;
      })
      .join('');

    const messageBlock = params.message?.trim()
      ? `
        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin: 0 0 24px;">
          <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #9a3412; text-transform: uppercase; letter-spacing: 0.04em;">
            Message from FinPay team
          </p>
          <p style="margin: 0; color: #374151; white-space: pre-wrap;">${this.escapeHtml(params.message.trim())}</p>
        </div>`
      : '';

    const content = `
      <p style="margin: 0 0 16px; font-size: 16px; color: #111827;">
        Dear ${this.escapeHtml(params.fullName)},
      </p>
      <p style="margin: 0 0 16px; color: #374151;">
        Our team has reviewed your agent registration and needs a few document updates before we can approve your account.
      </p>
      ${messageBlock}
      <p style="margin: 0 0 12px; font-size: 13px; font-weight: 700; color: #5b21b6; text-transform: uppercase; letter-spacing: 0.04em;">
        Documents requested
      </p>
      ${itemRows}
      <p style="margin: 24px 0 0;">
        <a
          href="${this.escapeHtml(params.uploadUrl)}"
          style="display: inline-block; background: #5b21b6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; font-size: 14px;"
        >
          Upload documents
        </a>
      </p>
      <p style="margin: 16px 0 0; font-size: 13px; color: #6b7280; word-break: break-all;">
        Or sign in and open: <a href="${this.escapeHtml(params.uploadUrl)}" style="color: #5b21b6;">${this.escapeHtml(params.uploadUrl)}</a>
      </p>
      <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px;">
        Best regards,<br />
        <strong style="color: #5b21b6;">FinPay Team</strong>
      </p>`;

    return this.buildFinPayEmailShell({
      badge: 'Action Required',
      title: 'Document update requested',
      subtitle: 'Please re-upload or submit the listed documents',
      content,
    });
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

  private buildAgentAccountCreatedByAdminText(
    params: SendAgentAccountCreatedByAdminParams,
  ): string {
    return [
      `Dear ${params.fullName},`,
      '',
      'A FinPay partner agent account has been created for you by our admin team.',
      '',
      `Agent type: ${params.agentTypeLabel}`,
      `Login email: ${params.email}`,
      `Temporary password: ${params.temporaryPassword}`,
      '',
      'Please sign in and change your password after your first login.',
      '',
      `Sign in: ${params.loginUrl}`,
      '',
      'Best regards,',
      'FinPay Team',
    ].join('\n');
  }

  private buildAgentAccountCreatedByAdminHtml(
    params: SendAgentAccountCreatedByAdminParams,
  ): string {
    const content = `
      <p style="margin: 0 0 16px; font-size: 16px; color: #111827;">
        Dear ${this.escapeHtml(params.fullName)},
      </p>
      <p style="margin: 0 0 16px; color: #374151;">
        A <strong>FinPay partner agent</strong> account has been created for you by our admin team.
        You can sign in with the credentials below.
      </p>
      <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
        <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #5b21b6; text-transform: uppercase; letter-spacing: 0.04em;">
          Your login details
        </p>
        <p style="margin: 0 0 6px; color: #374151;"><strong>Agent type:</strong> ${this.escapeHtml(params.agentTypeLabel)}</p>
        <p style="margin: 0 0 6px; color: #374151;"><strong>Email:</strong> ${this.escapeHtml(params.email)}</p>
        <p style="margin: 0; color: #374151;"><strong>Temporary password:</strong> <code style="font-size: 15px; background: #ede9fe; padding: 2px 8px; border-radius: 6px;">${this.escapeHtml(params.temporaryPassword)}</code></p>
      </div>
      <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
        <p style="margin: 0; color: #9a3412; font-size: 14px;">
          For your security, please change this password after your first sign-in.
        </p>
      </div>
      <p style="margin: 0 0 24px;">
        <a
          href="${this.escapeHtml(params.loginUrl)}"
          style="display: inline-block; background: #5b21b6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600;"
        >
          Sign in to FinPay
        </a>
      </p>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        Or open: <a href="${this.escapeHtml(params.loginUrl)}" style="color: #5b21b6;">${this.escapeHtml(params.loginUrl)}</a>
      </p>
      <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px;">
        Best regards,<br />
        <strong style="color: #5b21b6;">FinPay Team</strong>
      </p>`;

    return this.buildFinPayEmailShell({
      badge: 'Partner Agent',
      title: 'Your account is ready',
      subtitle: 'Sign in with the credentials below',
      content,
    });
  }

  private buildAgentApprovedText(params: SendAgentApprovedParams): string {
    return [
      `Dear ${params.fullName},`,
      '',
      'Good news — your FinPay partner agent account has been approved.',
      '',
      `Agent type: ${params.agentTypeLabel}`,
      `Reference ID: ${params.userId}`,
      '',
      'You can now sign in and start partnering with FinPay.',
      '',
      `Sign in: ${params.loginUrl}`,
      '',
      'Best regards,',
      'FinPay Team',
    ].join('\n');
  }

  private buildAgentApprovedHtml(params: SendAgentApprovedParams): string {
    const content = `
      <p style="margin: 0 0 16px; font-size: 16px; color: #111827;">
        Dear ${this.escapeHtml(params.fullName)},
      </p>
      <p style="margin: 0 0 16px; color: #374151;">
        Good news — your <strong>FinPay partner agent</strong> account has been approved.
        You can now sign in and start partnering with us.
      </p>
      <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
        <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #5b21b6; text-transform: uppercase; letter-spacing: 0.04em;">
          Account details
        </p>
        <p style="margin: 0 0 6px; color: #374151;"><strong>Agent type:</strong> ${this.escapeHtml(params.agentTypeLabel)}</p>
        <p style="margin: 0; color: #374151;"><strong>Reference ID:</strong> ${this.escapeHtml(params.userId)}</p>
      </div>
      <p style="margin: 0 0 24px;">
        <a
          href="${this.escapeHtml(params.loginUrl)}"
          style="display: inline-block; background: #5b21b6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; font-size: 14px;"
        >
          Sign in to FinPay
        </a>
      </p>
      <p style="margin: 0; font-size: 13px; color: #6b7280; word-break: break-all;">
        Or open: <a href="${this.escapeHtml(params.loginUrl)}" style="color: #5b21b6;">${this.escapeHtml(params.loginUrl)}</a>
      </p>
      <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px;">
        Best regards,<br />
        <strong style="color: #5b21b6;">FinPay Team</strong>
      </p>`;

    return this.buildFinPayEmailShell({
      badge: 'Partner Agent',
      title: 'Account approved',
      subtitle: 'You can now sign in to FinPay',
      content,
    });
  }

  private buildAgentRejectedText(params: SendAgentRejectedParams): string {
    return [
      `Dear ${params.fullName},`,
      '',
      'Thank you for applying as a FinPay partner agent. After reviewing your registration, we are unable to approve your account at this time.',
      '',
      `Agent type: ${params.agentTypeLabel}`,
      `Reference ID: ${params.userId}`,
      '',
      'Reason:',
      params.rejectionReason,
      '',
      'If you believe this is a mistake or would like to re-apply, please reply to this email or contact the FinPay team.',
      '',
      'Best regards,',
      'FinPay Team',
    ].join('\n');
  }

  private buildAgentRejectedHtml(params: SendAgentRejectedParams): string {
    const content = `
      <p style="margin: 0 0 16px; font-size: 16px; color: #111827;">
        Dear ${this.escapeHtml(params.fullName)},
      </p>
      <p style="margin: 0 0 16px; color: #374151;">
        Thank you for applying as a <strong>FinPay partner agent</strong>.
        After reviewing your registration, we are unable to approve your account at this time.
      </p>
      <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
        <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #5b21b6; text-transform: uppercase; letter-spacing: 0.04em;">
          Application details
        </p>
        <p style="margin: 0 0 6px; color: #374151;"><strong>Agent type:</strong> ${this.escapeHtml(params.agentTypeLabel)}</p>
        <p style="margin: 0; color: #374151;"><strong>Reference ID:</strong> ${this.escapeHtml(params.userId)}</p>
      </div>
      <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
        <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #9a3412; text-transform: uppercase; letter-spacing: 0.04em;">
          Reason
        </p>
        <p style="margin: 0; color: #374151; white-space: pre-wrap;">${this.escapeHtml(params.rejectionReason)}</p>
      </div>
      <p style="margin: 0; color: #374151;">
        If you believe this is a mistake or would like to re-apply, please reply to this email or contact the FinPay team.
      </p>
      <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px;">
        Best regards,<br />
        <strong style="color: #5b21b6;">FinPay Team</strong>
      </p>`;

    return this.buildFinPayEmailShell({
      badge: 'Registration Update',
      title: 'Application not approved',
      subtitle: 'Please review the details below',
      content,
    });
  }

  private buildAgentReviewAdminNotificationText(
    params: SendAgentReviewAdminNotificationParams,
  ): string {
    const heading: Record<AgentReviewAction, string> = {
      approved: 'A partner agent registration has been approved.',
      rejected: 'A partner agent registration has been rejected.',
      documents_requested:
        'A document update has been requested for a partner agent registration.',
    };

    const lines = [
      heading[params.action],
      '',
      'Agent Details',
      `User ID: ${params.userId}`,
      `Name: ${params.fullName}`,
      `Email: ${params.email}`,
      `Phone: ${params.phoneNumber ?? '—'}`,
      `Agent Type: ${params.agentTypeLabel}`,
      `Actioned At: ${params.actedAt}`,
    ];

    if (params.action === 'rejected') {
      lines.push('', 'Rejection Reason:', params.rejectionReason?.trim() || '—');
    }

    if (params.action === 'documents_requested') {
      if (params.message?.trim()) {
        lines.push('', 'Message:', params.message.trim());
      }
      lines.push('', 'Documents requested:');
      for (const item of params.documentItems ?? []) {
        const typeLabel =
          item.requestType === 'update' ? 'Re-upload' : 'Additional document';
        lines.push(`• [${typeLabel}] ${item.label}`);
        if (item.adminNote?.trim()) {
          lines.push(`  Note: ${item.adminNote.trim()}`);
        }
      }
    }

    lines.push('', `Review in admin: ${params.reviewUrl}`);
    return lines.join('\n');
  }

  private buildAgentReviewAdminNotificationHtml(
    params: SendAgentReviewAdminNotificationParams,
  ): string {
    const intro: Record<AgentReviewAction, string> = {
      approved:
        'A partner agent registration has been approved. A copy of this decision is below for your records.',
      rejected:
        'A partner agent registration has been rejected. A copy of this decision is below for your records.',
      documents_requested:
        'A document update has been requested for a partner agent. A copy of this request is below for your records.',
    };

    const title: Record<AgentReviewAction, string> = {
      approved: 'Agent approved',
      rejected: 'Agent registration rejected',
      documents_requested: 'Document update requested',
    };

    const summaryRows: [string, string][] = [
      ['User ID', params.userId],
      ['Name', params.fullName],
      ['Email', params.email],
      ['Phone', params.phoneNumber ?? '—'],
      ['Agent Type', params.agentTypeLabel],
      ['Actioned At', params.actedAt],
      [
        'Status',
        params.action === 'approved'
          ? 'Verified'
          : params.action === 'rejected'
            ? 'Rejected'
            : 'Pending document update',
      ],
    ];

    const reasonBlock =
      params.action === 'rejected'
        ? `
        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin: 0 0 24px;">
          <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #9a3412; text-transform: uppercase; letter-spacing: 0.04em;">
            Rejection reason
          </p>
          <p style="margin: 0; color: #374151; white-space: pre-wrap;">${this.escapeHtml(params.rejectionReason?.trim() || '—')}</p>
        </div>`
        : '';

    const documentItems = params.documentItems ?? [];
    const itemRows = documentItems
      .map((item) => {
        const typeLabel =
          item.requestType === 'update' ? 'Re-upload required' : 'Additional document';
        const typeColor = item.requestType === 'update' ? '#9a3412' : '#5b21b6';
        const note = item.adminNote?.trim()
          ? `<p style="margin: 8px 0 0; font-size: 13px; color: #6b7280;"><strong>Note:</strong> ${this.escapeHtml(item.adminNote.trim())}</p>`
          : '';

        return `
          <div style="border: 1px solid #ede9fe; border-radius: 12px; padding: 16px; margin-bottom: 12px; background: #fafafa;">
            <span style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: ${typeColor}; margin-bottom: 8px;">
              ${this.escapeHtml(typeLabel)}
            </span>
            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #111827;">
              ${this.escapeHtml(item.label)}
            </p>
            ${note}
          </div>`;
      })
      .join('');

    const messageBlock =
      params.action === 'documents_requested' && params.message?.trim()
        ? `
        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin: 0 0 24px;">
          <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #9a3412; text-transform: uppercase; letter-spacing: 0.04em;">
            Message sent to agent
          </p>
          <p style="margin: 0; color: #374151; white-space: pre-wrap;">${this.escapeHtml(params.message.trim())}</p>
        </div>`
        : '';

    const documentsBlock =
      params.action === 'documents_requested'
        ? `
        ${messageBlock}
        <p style="margin: 0 0 12px; font-size: 13px; font-weight: 700; color: #5b21b6; text-transform: uppercase; letter-spacing: 0.04em;">
          Documents requested
        </p>
        ${itemRows}`
        : '';

    const content = `
      <p style="margin: 0 0 16px; color: #374151;">
        ${intro[params.action]}
      </p>
      ${this.buildDetailsSectionHtml('Agent Summary', summaryRows)}
      ${reasonBlock}
      ${documentsBlock}
      <p style="margin: 24px 0 0;">
        <a
          href="${this.escapeHtml(params.reviewUrl)}"
          style="display: inline-block; background: #5b21b6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; font-size: 14px;"
        >
          View agent in admin
        </a>
      </p>
      <p style="margin: 16px 0 0; font-size: 13px; color: #6b7280; word-break: break-all;">
        Or open: <a href="${this.escapeHtml(params.reviewUrl)}" style="color: #5b21b6;">${this.escapeHtml(params.reviewUrl)}</a>
      </p>`;

    return this.buildFinPayEmailShell({
      badge: 'Admin Alert',
      title: title[params.action],
      subtitle: params.fullName,
      content,
    });
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
