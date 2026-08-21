import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { HostingerService } from 'src/services/email/hostinger.service';
import { SmsService } from 'src/services/sms/sms.service';
import { SMS_TEMPLATE_KEYS } from 'src/services/sms/mappings/sms-template.registry';
import { User, UserDocument } from 'src/services/mongoose/schemas/user.schema';

export type ForexOrderStatusNotifyInput = {
  createdByUserId: string;
  previousStatus: string;
  newStatus: string;
  statusLabel?: string | null;
  orderCode?: string | null;
  prithviOrderId: string;
};

function normalizeStatus(status?: string | null): string {
  return String(status ?? '')
    .trim()
    .toUpperCase();
}

@Injectable()
export class ForexOrderNotificationService {
  private readonly logger = new Logger(ForexOrderNotificationService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly hostingerService: HostingerService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * Email (and SMS when newly DOCUMENTS_APPROVED_AWAITING_FUNDS) the signup
   * contact when sync changes status. Failures are logged and never thrown,
   * so order sync is not blocked.
   */
  async notifyIfStatusChanged(
    input: ForexOrderStatusNotifyInput,
  ): Promise<void> {
    const previous = normalizeStatus(input.previousStatus);
    const next = normalizeStatus(input.newStatus);
    if (!next || previous === next) {
      return;
    }

    const user = await this.userModel
      .findById(String(input.createdByUserId))
      .select('firstName lastName email phoneNumber')
      .lean()
      .exec();

    if (!user) {
      this.logger.warn(
        `Skipping forex status notify; user not found. userId=${input.createdByUserId} order=${input.prithviOrderId}`,
      );
      return;
    }

    const name =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      'Customer';
    const orderRef =
      input.orderCode?.trim() || input.prithviOrderId.slice(0, 8);
    const statusLabel = input.statusLabel?.trim() || next;

    if (next === 'DOCUMENTS_APPROVED_AWAITING_FUNDS') {
      await this.sendApprovedNotifications({
        name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        orderRef,
      });
      return;
    }

    await this.sendStatusUpdateEmail({
      name,
      email: user.email,
      orderRef,
      status: next,
      statusLabel,
    });
  }

  private async sendApprovedNotifications(params: {
    name: string;
    email?: string;
    phoneNumber?: string;
    orderRef: string;
  }): Promise<void> {
    if (params.email?.trim()) {
      try {
        await this.hostingerService.sendForexOrderApproved({
          to: params.email.trim(),
          fullName: params.name,
          orderRef: params.orderRef,
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to send forex approved email for ${params.orderRef}: ${detail}`,
        );
      }
    } else {
      this.logger.warn(
        `No signup email for forex approved notify. order=${params.orderRef}`,
      );
    }

    if (params.phoneNumber?.trim()) {
      try {
        await this.smsService.sendTemplatedSms({
          templateKey: SMS_TEMPLATE_KEYS.FOREX_ORDER_APPROVED,
          destinations: params.phoneNumber.trim(),
          variables: {
            name: params.name,
            order: params.orderRef,
          },
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to send forex approved SMS for ${params.orderRef}: ${detail}`,
        );
      }
    } else {
      this.logger.warn(
        `No signup phone for forex approved SMS. order=${params.orderRef}`,
      );
    }
  }

  private async sendStatusUpdateEmail(params: {
    name: string;
    email?: string;
    orderRef: string;
    status: string;
    statusLabel: string;
  }): Promise<void> {
    if (!params.email?.trim()) {
      this.logger.warn(
        `No signup email for forex status update. order=${params.orderRef} status=${params.status}`,
      );
      return;
    }

    try {
      await this.hostingerService.sendForexOrderStatusUpdate({
        to: params.email.trim(),
        fullName: params.name,
        orderRef: params.orderRef,
        status: params.status,
        statusLabel: params.statusLabel,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send forex status email for ${params.orderRef}: ${detail}`,
      );
    }
  }
}
