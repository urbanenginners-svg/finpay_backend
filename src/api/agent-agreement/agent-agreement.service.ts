import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  AGENT_AGREEMENT_TEMPLATE_VERSION,
  AgentAgreement,
  AgentAgreementCommission,
  AgentAgreementDetails,
  AgentAgreementDocument,
  AgentAgreementStatusEnum,
} from 'src/services/mongoose/schemas/agent-agreement.schema';
import { User } from 'src/services/mongoose/schemas/user.schema';
import { AgentCardRateService } from 'src/services/agent-card-rate/agent-card-rate.service';
import { PrithviForexApiService } from 'src/services/prithvi-exchange/prithvi-forex-api.service';
import { roundMoney } from 'src/utils/agent-commission.util';
import { UserTypeEnum } from 'src/utils/enums/user-type.enum';
import { AcceptAgentAgreementDto, UpsertAgentAgreementDto } from './dto';

type AuthUser = {
  _id: string;
  userType?: string;
};

export type AcceptanceContext = {
  ipAddress?: string;
  userAgent?: string;
};

export type AdminAgentAgreementView = {
  agreement: AgentAgreementDocument | null;
  /** Commission rows as currently configured on the agent's card rates. */
  currentCommissions: AgentAgreementCommission[];
};

const DEFAULT_PURPOSE_LABEL = 'All other purposes (default)';

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function commissionsKey(rows: AgentAgreementCommission[] | undefined): string {
  return JSON.stringify(
    (rows ?? []).map((row) => [
      row.currency ?? '',
      row.purposeCode ?? '',
      roundMoney(Number(row.finpayCommission ?? 0)),
    ]),
  );
}

function partyKey(d: AgentAgreementDetails): string {
  return JSON.stringify([
    d.firmName,
    d.firmAddress,
    d.signatoryName,
    d.signatoryDesignation,
    d.commencementDate,
  ]);
}

@Injectable()
export class AgentAgreementService {
  private readonly logger = new Logger(AgentAgreementService.name);

  constructor(
    @InjectModel(AgentAgreement.name)
    private readonly agreementModel: Model<AgentAgreementDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly agentCardRates: AgentCardRateService,
    private readonly prithviForex: PrithviForexApiService,
  ) {}

  assertAgent(user: AuthUser): string {
    if (user?.userType !== UserTypeEnum.AGENT) {
      throw new ForbiddenException('Only agents have a referral agreement.');
    }
    return String(user._id);
  }

  /**
   * Annexure A rows: the effective commission for every TT purpose and currency,
   * resolved like bookings do (purpose-specific row, else the default row for that currency).
   */
  async buildCommissionSnapshot(agentId: string): Promise<AgentAgreementCommission[]> {
    const [rows, purposes] = await Promise.all([
      this.agentCardRates.listByAgent(agentId),
      this.loadTtPurposes(),
    ]);

    const defaults = new Map<string, number>();
    const specific = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const purposeCode = String(row.purposeCode ?? '').trim();
      const commission = roundMoney(Number(row.finpayCommission) || 0);
      if (!purposeCode) {
        defaults.set(row.currency, commission);
        continue;
      }
      if (!specific.has(purposeCode)) specific.set(purposeCode, new Map());
      specific.get(purposeCode)!.set(row.currency, commission);
    }

    const purposeList = [...purposes];
    for (const code of specific.keys()) {
      if (!purposeList.some((p) => p.code === code)) purposeList.push({ code, name: code });
    }
    purposeList.sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code));

    const result: AgentAgreementCommission[] = [];
    for (const purpose of purposeList) {
      const overrides = specific.get(purpose.code) ?? new Map<string, number>();
      const currencies = [...new Set([...defaults.keys(), ...overrides.keys()])].sort();
      for (const currency of currencies) {
        const commission = overrides.has(currency) ? overrides.get(currency)! : defaults.get(currency)!;
        if (commission > 0) {
          result.push({
            currency,
            purposeCode: purpose.code,
            purposeName: purpose.name,
            finpayCommission: commission,
          });
        }
      }
    }

    // Without a purpose catalogue, fall back to listing the default rows on their own.
    if (purposes.length === 0) {
      for (const [currency, commission] of [...defaults.entries()].sort()) {
        if (commission > 0) {
          result.push({
            currency,
            purposeCode: '',
            purposeName: DEFAULT_PURPOSE_LABEL,
            finpayCommission: commission,
          });
        }
      }
    }
    return result;
  }

  async findForAgent(agentId: string): Promise<AgentAgreementDocument | null> {
    const agreement = await this.agreementModel.findOne({ agentId: String(agentId) }).exec();
    if (agreement) {
      await this.refreshPendingCommissions(agreement);
    }
    return agreement;
  }

  async accept(
    agentId: string,
    dto: AcceptAgentAgreementDto,
    context: AcceptanceContext,
  ): Promise<AgentAgreementDocument> {
    const agreement = await this.agreementModel.findOne({ agentId: String(agentId) }).exec();
    if (!agreement) {
      throw new NotFoundException('Your agreement has not been issued yet. Please contact Finpay.');
    }
    if (agreement.version !== dto.version) {
      throw new ConflictException(
        'This agreement was updated by Finpay while you were reviewing it. Please review the latest version.',
      );
    }
    if (agreement.status === AgentAgreementStatusEnum.ACCEPTED) {
      throw new ConflictException('You have already accepted this agreement.');
    }
    if (await this.refreshPendingCommissions(agreement)) {
      throw new ConflictException(
        'The commission rates in Annexure A were updated while you were reviewing. Please review the latest rates and accept again.',
      );
    }
    if (!agreement.details.commissions?.length) {
      throw new BadRequestException(
        'Commission rates have not been configured for your account yet. Please contact Finpay.',
      );
    }
    if (normalizeName(dto.signedName) !== normalizeName(agreement.details.signatoryName)) {
      throw new BadRequestException(
        `The signature must match the authorized signatory name on the agreement (${agreement.details.signatoryName}).`,
      );
    }

    agreement.acceptance = {
      version: agreement.version,
      templateVersion: agreement.templateVersion,
      details: agreement.details,
      signedName: dto.signedName,
      acceptedAt: new Date(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent?.slice(0, 500),
    };
    agreement.status = AgentAgreementStatusEnum.ACCEPTED;
    return agreement.save();
  }

  async findForAdmin(agentId: string): Promise<AdminAgentAgreementView> {
    await this.assertAgentExists(agentId);
    const [agreement, currentCommissions] = await Promise.all([
      this.findForAgent(agentId),
      this.buildCommissionSnapshot(agentId),
    ]);
    return { agreement, currentCommissions };
  }

  async upsertByAdmin(
    agentId: string,
    dto: UpsertAgentAgreementDto,
    adminId: string,
  ): Promise<AgentAgreementDocument> {
    await this.assertAgentExists(agentId);
    const commissions = await this.buildCommissionSnapshot(agentId);
    if (commissions.length === 0) {
      throw new BadRequestException(
        'Set this agent’s commissions on the Agent Card Rates page before issuing the agreement.',
      );
    }

    const details: AgentAgreementDetails = {
      firmName: dto.firmName,
      firmAddress: dto.firmAddress,
      signatoryName: dto.signatoryName,
      signatoryDesignation: dto.signatoryDesignation,
      commencementDate: dto.commencementDate,
      commissions,
    };
    const existing = await this.agreementModel.findOne({ agentId: String(agentId) }).exec();

    if (!existing) {
      return this.agreementModel.create({
        agentId: String(agentId),
        details,
        version: 1,
        templateVersion: AGENT_AGREEMENT_TEMPLATE_VERSION,
        status: AgentAgreementStatusEnum.PENDING,
        issuedAt: new Date(),
        issuedBy: String(adminId),
        acceptance: null,
        acceptanceHistory: [],
      });
    }

    if (
      partyKey(existing.details) === partyKey(details) &&
      commissionsKey(existing.details.commissions) === commissionsKey(details.commissions)
    ) {
      return existing;
    }

    if (existing.acceptance) {
      existing.acceptanceHistory.push(existing.acceptance);
    }
    existing.details = details;
    existing.version += 1;
    existing.templateVersion = AGENT_AGREEMENT_TEMPLATE_VERSION;
    existing.status = AgentAgreementStatusEnum.PENDING;
    existing.acceptance = null;
    existing.issuedAt = new Date();
    existing.issuedBy = String(adminId);
    return existing.save();
  }

  /**
   * Until accepted, Annexure A mirrors the live card-rate commissions.
   * Accepted agreements keep the snapshot the agent signed.
   * Returns true when the stored rows changed.
   */
  private async refreshPendingCommissions(agreement: AgentAgreementDocument): Promise<boolean> {
    if (agreement.status !== AgentAgreementStatusEnum.PENDING) return false;
    const latest = await this.buildCommissionSnapshot(agreement.agentId);
    const stored = agreement.details.commissions ?? [];
    const namesChanged = latest.some((row, i) => row.purposeName !== stored[i]?.purposeName);
    if (commissionsKey(stored) === commissionsKey(latest) && !namesChanged) return false;

    agreement.details.commissions = latest;
    agreement.markModified('details.commissions');
    await agreement.save();
    return commissionsKey(stored) !== commissionsKey(latest);
  }

  /** Same purpose list the admin card-rates page offers (BUY / TT). */
  private async loadTtPurposes(): Promise<{ code: string; name: string }[]> {
    try {
      const purposes = await this.prithviForex.listPurposes({ orderType: 'BUY', productType: 'TT' });
      const seen = new Set<string>();
      const list: { code: string; name: string }[] = [];
      for (const purpose of purposes) {
        const code = String(purpose.code ?? '').trim();
        if (!code || seen.has(code)) continue;
        seen.add(code);
        list.push({ code, name: purpose.name || code });
      }
      return list;
    } catch (err) {
      this.logger.warn(`Could not load purposes for agreement: ${String(err)}`);
      return [];
    }
  }

  private async assertAgentExists(agentId: string): Promise<void> {
    const agent = await this.userModel
      .findOne({ _id: agentId, deletedAt: null })
      .select('_id userType')
      .lean()
      .exec();
    if (!agent || agent.userType !== UserTypeEnum.AGENT) {
      throw new NotFoundException('Agent not found');
    }
  }
}
