import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';

import {
  AgentCustomer,
  AgentCustomerDocument,
} from 'src/services/mongoose/schemas/agent-customer.schema';
import {
  Beneficiary,
  BeneficiaryDocument,
} from 'src/services/mongoose/schemas/beneficiary.schema';
import { UserTypeEnum } from 'src/utils/enums/user-type.enum';
import { CreateAgentCustomerDto, UpdateAgentCustomerDto } from './dto';

type AuthUser = {
  _id: string;
  userType?: string;
};

@Injectable()
export class AgentCustomerService {
  constructor(
    @InjectModel(AgentCustomer.name)
    private readonly agentCustomerModel: Model<AgentCustomerDocument>,
    @InjectModel(Beneficiary.name)
    private readonly beneficiaryModel: Model<BeneficiaryDocument>,
  ) {}

  assertAgent(user: AuthUser): string {
    if (user?.userType !== UserTypeEnum.AGENT) {
      throw new ForbiddenException(
        'Only agents can manage walk-in customers. These records are not Finpay app users.',
      );
    }
    return String(user._id);
  }

  async list(
    agentId: string,
    search?: string,
  ): Promise<AgentCustomerDocument[]> {
    const filter: FilterQuery<AgentCustomerDocument> = {
      agentId: String(agentId),
    };

    const q = search?.trim();
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { phoneNumber: regex },
        { email: regex },
        { panNumber: regex },
      ];
    }

    return this.agentCustomerModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .exec();
  }

  async findOwned(
    agentId: string,
    customerId: string,
  ): Promise<AgentCustomerDocument> {
    const doc = await this.agentCustomerModel
      .findOne({
        _id: customerId,
        agentId: String(agentId),
      })
      .exec();

    if (!doc) {
      throw new NotFoundException('Customer not found');
    }

    return doc;
  }

  async create(
    agentId: string,
    dto: CreateAgentCustomerDto,
  ): Promise<AgentCustomerDocument> {
    return this.agentCustomerModel.create({
      agentId: String(agentId),
      firstName: dto.firstName.trim(),
      lastName: dto.lastName?.trim() || null,
      phoneNumber: dto.phoneNumber.trim(),
      email: dto.email.trim().toLowerCase(),
      panNumber: dto.panNumber.trim().toUpperCase(),
      dateOfBirth: dto.dateOfBirth.trim(),
      address: dto.address.trim(),
      city: dto.city.trim(),
      state: dto.state,
      pincode: dto.pincode.trim(),
      panVerified: dto.panVerified === true,
    });
  }

  async update(
    agentId: string,
    customerId: string,
    dto: UpdateAgentCustomerDto,
  ): Promise<AgentCustomerDocument> {
    const doc = await this.findOwned(agentId, customerId);

    if (dto.firstName !== undefined) doc.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) {
      doc.lastName = dto.lastName?.trim() || null;
    }
    if (dto.phoneNumber !== undefined) {
      doc.phoneNumber = dto.phoneNumber.trim();
    }
    if (dto.email !== undefined) {
      doc.email = dto.email.trim().toLowerCase();
    }
    if (dto.panNumber !== undefined) {
      doc.panNumber = dto.panNumber.trim().toUpperCase();
      if (dto.panVerified === undefined) {
        doc.panVerified = false;
      }
    }
    if (dto.dateOfBirth !== undefined) {
      doc.dateOfBirth = dto.dateOfBirth.trim();
    }
    if (dto.address !== undefined) doc.address = dto.address.trim();
    if (dto.city !== undefined) doc.city = dto.city.trim();
    if (dto.state !== undefined) doc.state = dto.state;
    if (dto.pincode !== undefined) doc.pincode = dto.pincode.trim();
    if (dto.panVerified !== undefined) {
      doc.panVerified = dto.panVerified === true;
    }

    await doc.save();
    return doc;
  }

  async remove(agentId: string, customerId: string): Promise<void> {
    const owned = await this.findOwned(agentId, customerId);
    await this.beneficiaryModel
      .deleteMany({
        userId: String(agentId),
        agentCustomerId: String(owned._id),
      })
      .exec();
    await this.agentCustomerModel.deleteOne({ _id: owned._id }).exec();
  }
}
