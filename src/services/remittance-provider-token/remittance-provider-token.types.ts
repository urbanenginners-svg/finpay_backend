import { RemittanceProvider } from 'src/utils/enums/remittance-provider.enum';

export type UpsertProviderTokenParams = {
  provider: RemittanceProvider;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  tokenType?: string;
  scope?: string;
};

export type StoredProviderToken = {
  provider: RemittanceProvider;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  tokenType?: string;
  scope?: string;
};
