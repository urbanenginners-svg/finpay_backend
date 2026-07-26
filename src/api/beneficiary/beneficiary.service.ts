import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  Beneficiary,
  BeneficiaryDocument,
} from 'src/services/mongoose/schemas/beneficiary.schema';
import { CreateBeneficiaryDto } from './dto';

@Injectable()
export class BeneficiaryService {
  constructor(
    @InjectModel(Beneficiary.name)
    private readonly beneficiaryModel: Model<BeneficiaryDocument>,
  ) {}

  async listForUser(userId: string): Promise<BeneficiaryDocument[]> {
    return this.beneficiaryModel
      .find({ userId: String(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async create(
    userId: string,
    dto: CreateBeneficiaryDto,
  ): Promise<BeneficiaryDocument> {
    const isInterim = dto.isInterimBankSelected === true;

    return this.beneficiaryModel.create({
      userId: String(userId),
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
  ): Promise<BeneficiaryDocument> {
    const doc = await this.beneficiaryModel
      .findOne({
        _id: beneficiaryId,
        userId: String(userId),
      })
      .exec();

    if (!doc) {
      throw new NotFoundException('Beneficiary not found');
    }

    return doc;
  }
}
