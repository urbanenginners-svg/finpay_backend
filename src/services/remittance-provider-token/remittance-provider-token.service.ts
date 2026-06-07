import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  RemittanceProviderToken,
  RemittanceProviderTokenDocument,
} from 'src/services/mongoose/schemas/remittance-provider-token.schema';
import { RemittanceProvider } from 'src/utils/enums/remittance-provider.enum';
import type {
  StoredProviderToken,
  UpsertProviderTokenParams,
} from './remittance-provider-token.types';

@Injectable()
export class RemittanceProviderTokenService {
  private readonly logger = new Logger(RemittanceProviderTokenService.name);

  constructor(
    @InjectModel(RemittanceProviderToken.name)
    private readonly tokenModel: Model<RemittanceProviderTokenDocument>,
  ) {}

  async findByProvider(
    provider: RemittanceProvider,
  ): Promise<StoredProviderToken | null> {
    const doc = await this.tokenModel
      .findOne({ provider })
      .select('+accessToken +refreshToken')
      .lean()
      .exec();

    if (!doc) {
      return null;
    }

    return {
      provider: doc.provider,
      accessToken: doc.accessToken,
      refreshToken: doc.refreshToken,
      expiresAt: doc.expiresAt,
      tokenType: doc.tokenType,
      scope: doc.scope,
    };
  }

  async upsert(params: UpsertProviderTokenParams): Promise<StoredProviderToken> {
    const doc = await this.tokenModel
      .findOneAndUpdate(
        { provider: params.provider },
        {
          $set: {
            accessToken: params.accessToken,
            refreshToken: params.refreshToken,
            expiresAt: params.expiresAt,
            tokenType: params.tokenType ?? 'Bearer',
            scope: params.scope,
          },
        },
        { upsert: true, new: true },
      )
      .select('+accessToken +refreshToken')
      .exec();

    this.logger.log(`OAuth tokens persisted for provider "${params.provider}".`);

    return {
      provider: doc.provider,
      accessToken: doc.accessToken,
      refreshToken: doc.refreshToken,
      expiresAt: doc.expiresAt,
      tokenType: doc.tokenType,
      scope: doc.scope,
    };
  }

  async deleteByProvider(provider: RemittanceProvider): Promise<void> {
    await this.tokenModel.deleteOne({ provider }).exec();
    this.logger.log(`OAuth tokens cleared for provider "${provider}".`);
  }
}
