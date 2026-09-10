import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';

import {
  Beneficiary,
  BeneficiaryDocument,
} from 'src/services/mongoose/schemas/beneficiary.schema';
import {
  AgentCustomer,
  AgentCustomerDocument,
} from 'src/services/mongoose/schemas/agent-customer.schema';
import { UserTypeEnum } from 'src/utils/enums/user-type.enum';
import { CreateBeneficiaryDto } from './dto';

type AuthUser = {
  _id: string;
  userType?: string;
};

@Injectable()
export class BeneficiaryService {
  constructor(
    @InjectModel(Beneficiary.name)
    private readonly beneficiaryModel: Model<BeneficiaryDocument>,
    @InjectModel(AgentCustomer.name)
    private readonly agentCustomerModel: Model<AgentCustomerDocument>,
  ) {}

  async listForUser(
    user: AuthUser,
    agentCustomerId?: string,
  ): Promise<BeneficiaryDocument[]> {
    const userId = String(user._id);
    const filter: FilterQuery<BeneficiaryDocument> = { userId };

    if (user.userType === UserTypeEnum.AGENT) {
      const customerId = agentCustomerId?.trim();
      if (!customerId) {
        throw new BadRequestException(
          'agentCustomerId is required to list beneficiaries for an agent customer',
        );
      }
      await this.assertOwnedAgentCustomer(userId, customerId);
      filter.agentCustomerId = customerId;
    } else if (agentCustomerId?.trim()) {
      throw new ForbiddenException(
        'agentCustomerId is only valid for agent accounts',
      );
    } else {
      filter.$or = [
        { agentCustomerId: null },
        { agentCustomerId: { $exists: false } },
      ];
    }

    return this.beneficiaryModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();
  }

  async create(
    user: AuthUser,
    dto: CreateBeneficiaryDto,
  ): Promise<BeneficiaryDocument> {
    const userId = String(user._id);
    const isAgent = user.userType === UserTypeEnum.AGENT;
    let agentCustomerId: string | null = null;

    if (isAgent) {
      const customerId = dto.agentCustomerId?.trim();
      if (!customerId) {
        throw new BadRequestException(
          'agentCustomerId is required when an agent saves a beneficiary',
        );
      }
      await this.assertOwnedAgentCustomer(userId, customerId);
      agentCustomerId = customerId;
    } else if (dto.agentCustomerId?.trim()) {
      throw new ForbiddenException(
        'Finpay app users cannot attach agentCustomerId to beneficiaries',
      );
    }

    const isInterim = dto.isInterimBankSelected === true;

    return this.beneficiaryModel.create({
      userId,
      agentCustomerId,
      institutionName: dto.institutionName.trim(),
      institutionAddress: dto.institutionAddress.trim(),
      swiftCode: dto.swiftCode.trim(),
      routingNumber: dto.routingNumber.trim(),
      bankAccountNumber: dto.bankAccountNumber.trim(),
      bankName: dto.bankName.trim(),
      beneficiaryBankAddress: dto.beneficiaryBankAddress.trim(),
      additionalInfo: dto.additionalInfo?.trim() || null,
      benCountry: dto.benCountry.trim(),
      beneficiaryRelation: dto.beneficiaryRelation.trim(),
      isInterimBankSelected: isInterim,
      interimBankName: isInterim ? dto.interimBankName?.trim() || null : null,
      interimBankAddress: isInterim
        ? dto.interimBankAddress?.trim() || null
        : null,
      interimBankCode: isInterim ? dto.interimBankCode?.trim() || null : null,
      interimBankCountry: isInterim
        ? dto.interimBankCountry?.trim() || null
        : null,
    });
  }

  async findOwnedByUser(
    userId: string,
    beneficiaryId: string,
    agentCustomerId?: string | null,
  ): Promise<BeneficiaryDocument> {
    const filter: FilterQuery<BeneficiaryDocument> = {
      _id: beneficiaryId,
      userId: String(userId),
    };
    if (agentCustomerId) {
      filter.agentCustomerId = String(agentCustomerId);
    }

    const doc = await this.beneficiaryModel.findOne(filter).exec();

    if (!doc) {
      throw new NotFoundException('Beneficiary not found');
    }

    return doc;
  }

  private async assertOwnedAgentCustomer(
    agentId: string,
    customerId: string,
  ): Promise<void> {
    const customer = await this.agentCustomerModel
      .findOne({
        _id: customerId,
        agentId: String(agentId),
      })
      .select('_id')
      .lean()
      .exec();

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
  }
}
