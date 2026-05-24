import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  ServiceEnquiry,
  ServiceEnquiryDocument,
} from 'src/services/mongoose/schemas/service-enquiry.schema';
import { CreateServiceEnquiryDto, GetEnquiriesQueryDto } from './dto';
import { ServiceEnquiryStatus } from 'src/utils/enums/service-enquiry-status.enum';
import { ServiceEnquiryType } from 'src/utils/enums/service-enquiry-type.enum';
import {
  ENQUIRY_SOURCE,
  SERVICE_TYPE_LABELS,
  SupportedCurrency,
} from './constants/enquiry.constants';
import {
  computeFxEstimate,
  validateServiceDetails,
} from './validators/service-details.validator';
import { normalizePhoneNumber } from 'src/utils/helpers/phone.helper';
import { getPaginatedDataWithAggregation } from 'src/utils/services/get-paginated-data-aggregation.service';
import { SmsService } from 'src/services/sms/sms.service';
import { SMS_TEMPLATE_KEYS } from 'src/services/sms/mappings/sms-template.registry';
import { AppConfigService } from 'src/services/env/env.service';

@Injectable()
export class EnquiryService {
  private readonly logger = new Logger(EnquiryService.name);

  constructor(
    @InjectModel(ServiceEnquiry.name)
    private readonly enquiryModel: Model<ServiceEnquiryDocument>,
    private readonly smsService: SmsService,
    private readonly config: AppConfigService,
  ) {}

  getAvailableServices() {
    return Object.values(ServiceEnquiryType).map((value) => ({
      value,
      label: SERVICE_TYPE_LABELS[value],
    }));
  }

  async create(dto: CreateServiceEnquiryDto) {
    const validatedDetails = validateServiceDetails(
      dto.serviceType,
      dto.serviceDetails,
    );

    const contact = {
      fullName: dto.contact.fullName.trim(),
      mobile: normalizePhoneNumber(dto.contact.mobile),
      email: dto.contact.email.trim().toLowerCase(),
      callbackRequested: dto.contact.callbackRequested ?? false,
    };

    const enquiryData: Partial<ServiceEnquiry> = {
      serviceType: dto.serviceType,
      contact,
      serviceDetails: validatedDetails,
      status: ServiceEnquiryStatus.PENDING,
      source: ENQUIRY_SOURCE,
      isPriority: contact.callbackRequested,
    };

    if (
      dto.serviceType === ServiceEnquiryType.OUTWARD_REMITTANCE ||
      dto.serviceType === ServiceEnquiryType.FOREIGN_EXCHANGE
    ) {
      const currency = validatedDetails.currency as SupportedCurrency;
      const amount = validatedDetails.amount as number;
      const fx = computeFxEstimate(currency, amount);
      enquiryData.estimatedInrValue = fx.estimatedInrValue;
      enquiryData.fxRateUsed = fx.fxRateUsed;
      validatedDetails.estimatedInrValue = fx.estimatedInrValue;
      validatedDetails.fxRateUsed = fx.fxRateUsed;
    }

    const enquiry = new this.enquiryModel(enquiryData);
    const saved = await enquiry.save();

    this.notifyAdvisors(saved).catch((error) => {
      this.logger.error(
        `Failed to notify advisors for enquiry ${saved._id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    });

    return {
      enquiryId: saved._id,
      serviceType: saved.serviceType,
      status: saved.status,
      submittedAt: saved.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  async findOne(id: string): Promise<ServiceEnquiryDocument> {
    const enquiry = await this.enquiryModel.findById(id).exec();
    if (!enquiry) {
      throw new NotFoundException(`Enquiry with ID '${id}' not found`);
    }
    return enquiry;
  }

  async findAll(query: GetEnquiriesQueryDto) {
    const matchStage: Record<string, unknown> = {};

    if (query.serviceType) {
      matchStage.serviceType = query.serviceType;
    }

    if (query.status) {
      matchStage.status = query.status;
    }

    if (query.isPriority === 'true') {
      matchStage.isPriority = true;
    } else if (query.isPriority === 'false') {
      matchStage.isPriority = false;
    }

    if (query.q?.trim()) {
      const search = query.q.trim();
      matchStage.$or = [
        { 'contact.fullName': { $regex: search, $options: 'i' } },
        { 'contact.email': { $regex: search, $options: 'i' } },
        { 'contact.mobile': { $regex: search, $options: 'i' } },
        { referenceNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const aggregationPipeline: any[] = [
      { $match: matchStage },
      { $project: { __v: 0, keywords: 0 } },
    ];

    const [data, meta] = await getPaginatedDataWithAggregation(
      this.enquiryModel,
      query,
      aggregationPipeline,
    );

    return { data, meta };
  }

  private async notifyAdvisors(enquiry: ServiceEnquiryDocument): Promise<void> {
    const advisorPhones = this.parseAdvisorPhones();
    if (advisorPhones.length === 0) {
      this.logger.warn(
        `No ENQUIRY_ADVISOR_PHONES configured; skipping advisor SMS for enquiry ${enquiry._id}`,
      );
      return;
    }

    const priorityLabel = enquiry.isPriority ? ' (PRIORITY)' : '';

    await this.smsService.sendTemplatedSms({
      templateKey: SMS_TEMPLATE_KEYS.ENQUIRY_ADVISOR_ALERT,
      destinations: advisorPhones,
      variables: {
        service: SERVICE_TYPE_LABELS[enquiry.serviceType],
        name: enquiry.contact.fullName,
        mobile: enquiry.contact.mobile,
        ref: enquiry.referenceNumber ?? enquiry._id ?? '',
        priority: priorityLabel,
      },
    });
  }

  private parseAdvisorPhones(): string[] {
    const raw = this.config.get('ENQUIRY_ADVISOR_PHONES');
    if (!raw?.trim()) {
      return [];
    }
    return raw
      .split(',')
      .map((p) => normalizePhoneNumber(p.trim()))
      .filter(Boolean);
  }
}
