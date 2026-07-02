import axios from 'axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { AppConfigService } from 'src/services/env/env.service';
import { HttpFormService } from 'src/services/http';
import { RemittanceProviderTokenService } from 'src/services/remittance-provider-token';
import { RemittanceProvider } from 'src/utils/enums/remittance-provider.enum';
import {
  PRITHVI_API_PATHS,
  PRITHVI_DEFAULT_SCOPE,
  PRITHVI_TOKEN_REFRESH_BUFFER_MS,
} from './prithvi-exchange.constants';
import type {
  GetAgentRatesParams,
  PrithviAgentRateData,
  PrithviApiResponse,
  PrithviOAuthTokenData,
  PrithviTokenIntrospectionData,
} from './prithvi-exchange.types';

@Injectable()
export class PrithviExchangeService {
  private readonly logger = new Logger(PrithviExchangeService.name);
  private readonly provider = RemittanceProvider.PRITHVI;

  constructor(
    private readonly config: AppConfigService,
    private readonly tokenStore: RemittanceProviderTokenService,
    private readonly httpForm: HttpFormService,
  ) {}

  get isActive(): boolean {
    return this.config.get('PRITHVI_ACTIVE_MODE') === 'true';
  }

  /**
   * Obtain a new OAuth access token using client credentials grant.
   */
  async obtainToken(scope?: string): Promise<PrithviOAuthTokenData> {
    const clientId = this.requireConfig('PRITHVI_CLIENT_ID');
    const clientSecret = this.requireConfig('PRITHVI_CLIENT_SECRET');

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: scope ?? this.config.get('PRITHVI_SCOPE') ?? PRITHVI_DEFAULT_SCOPE,
    });

    const response = await this.postForm<PrithviOAuthTokenData>(
      PRITHVI_API_PATHS.OAUTH_TOKEN,
      body,
    );

    await this.cacheTokens(response);
    this.logger.log('Prithvi OAuth token obtained successfully.');
    return response;
  }

  /**
   * Exchange a refresh token for a newly rotated access token.
   */
  async refreshOAuthToken(refreshToken?: string): Promise<PrithviOAuthTokenData> {
    const clientId = this.requireConfig('PRITHVI_CLIENT_ID');
    const clientSecret = this.requireConfig('PRITHVI_CLIENT_SECRET');
    const stored = await this.tokenStore.findByProvider(this.provider);
    const token = refreshToken ?? stored?.refreshToken;

    if (!token) {
      return this.obtainToken();
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token,
    });

    try {
      const response = await this.postForm<PrithviOAuthTokenData>(
        PRITHVI_API_PATHS.OAUTH_REFRESH,
        body,
      );

      await this.cacheTokens(response);
      this.logger.log('Prithvi OAuth token refreshed successfully.');
      return response;
    } catch {
      this.logger.warn(
        'Prithvi refresh token failed; falling back to client credentials grant.',
      );
      return this.obtainToken();
    }
  }

  /**
   * Introspect an access or refresh token to check validity and metadata.
   */
  async introspectToken(
    token: string,
    tokenTypeHint?: 'access_token' | 'refresh_token',
  ): Promise<PrithviTokenIntrospectionData> {
    const accessToken = await this.getValidAccessToken();

    const body = new URLSearchParams({ token });
    if (tokenTypeHint) {
      body.set('token_type_hint', tokenTypeHint);
    }

    return this.postForm<PrithviTokenIntrospectionData>(
      PRITHVI_API_PATHS.OAUTH_INTROSPECT,
      body,
      { Authorization: `Bearer ${accessToken}` },
    );
  }

  /**
   * Revoke an access or refresh token immediately.
   */
  async revokeToken(token: string): Promise<void> {
    const accessToken = await this.getValidAccessToken();

    const body = new URLSearchParams({ token });

    await this.postForm<void>(
      PRITHVI_API_PATHS.OAUTH_REVOKE,
      body,
      { Authorization: `Bearer ${accessToken}` },
    );

    const stored = await this.tokenStore.findByProvider(this.provider);
    if (
      stored?.accessToken === token ||
      stored?.refreshToken === token
    ) {
      await this.tokenStore.deleteByProvider(this.provider);
    }

    this.logger.log('Prithvi token revoked successfully.');
  }

  /**
   * Fetch live FX rates for the configured agent account.
   */
  async getAgentRates(params: GetAgentRatesParams): Promise<PrithviAgentRateData> {
    if (!this.isActive) {
      this.logger.warn(
        `PRITHVI_ACTIVE_MODE is not "true"; returning dry-run rate. orderType=${params.orderType} productType=${params.productType}`,
      );
      return {
        currency: 'USD',
        rate: 83.5,
        timestamp: new Date().toISOString(),
      };
    }

    const agentId = params.agentId ?? this.requireConfig('PRITHVI_AGENT_ID');
    const accessToken = await this.getValidAccessToken();

    const url = this.buildUrl(PRITHVI_API_PATHS.AGENT_RATES);
    const response = await axios.get<PrithviApiResponse<PrithviAgentRateData>>(url, {
      params: {
        agentId,
        order_type: params.orderType,
        product_type: params.productType,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      },
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      this.logger.error(
        `Prithvi rates HTTP ${response.status}: ${JSON.stringify(response.data)}`,
      );
      throw new InternalServerErrorException(
        'Unable to fetch live rates right now. Please try again later.',
      );
    }

    if (!response.data?.success) {
      this.logger.error(
        `Prithvi rates API error: ${JSON.stringify(response.data)}`,
      );
      throw new InternalServerErrorException(
        'Unable to fetch live rates right now. Please try again later.',
      );
    }

    return response.data.data;
  }

  /**
   * Proactively refresh the cached token if it is near expiry.
   * Called by the scheduled task.
   */
  async ensureTokenFreshness(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    const stored = await this.tokenStore.findByProvider(this.provider);
    if (!stored) {
      await this.obtainToken();
      return;
    }

    const msUntilExpiry = stored.expiresAt.getTime() - Date.now();
    if (msUntilExpiry <= PRITHVI_TOKEN_REFRESH_BUFFER_MS) {
      await this.refreshOAuthToken();
    }
  }

  /**
   * Returns a valid access token, obtaining or refreshing as needed.
   */
  async getValidAccessToken(): Promise<string> {
    if (!this.isActive) {
      throw new InternalServerErrorException(
        'Prithvi Exchange is not active. Set PRITHVI_ACTIVE_MODE=true to enable.',
      );
    }

    const stored = await this.tokenStore.findByProvider(this.provider);

    if (
      stored &&
      stored.expiresAt.getTime() - Date.now() > PRITHVI_TOKEN_REFRESH_BUFFER_MS
    ) {
      return stored.accessToken;
    }

    if (stored?.refreshToken) {
      const data = await this.refreshOAuthToken();
      return data.access_token;
    }

    const data = await this.obtainToken();
    return data.access_token;
  }

  private async cacheTokens(data: PrithviOAuthTokenData): Promise<void> {
    await this.tokenStore.upsert({
      provider: this.provider,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
      scope: data.scope,
    });
  }

  /** Obtain a fresh token from Prithvi and persist it. Safe to expose via admin API. */
  async createAndStoreToken() {
    const data = await this.obtainToken();
    return this.toTokenSummary(data);
  }

  /** Refresh the stored token via Prithvi and persist the rotation. */
  async refreshAndStoreToken() {
    const data = await this.refreshOAuthToken();
    return this.toTokenSummary(data);
  }

  /** Read token metadata from DB; optionally validate via Prithvi introspect. */
  async getStoredTokenStatus(options?: { introspect?: boolean }) {
    if (!this.isActive) {
      return {
        provider: this.provider,
        active: false,
        stored: false,
        message:
          'Prithvi Exchange is inactive. Set PRITHVI_ACTIVE_MODE=true in .env.',
      };
    }

    const stored = await this.tokenStore.findByProvider(this.provider);

    if (!stored) {
      return {
        provider: this.provider,
        active: true,
        stored: false,
        message:
          'No token in database. Call POST /api/v1/remittance/providers/prithvi/token to create one.',
      };
    }

    const expiresInSeconds = Math.max(
      0,
      Math.floor((stored.expiresAt.getTime() - Date.now()) / 1000),
    );

    const status: Record<string, unknown> = {
      provider: this.provider,
      active: true,
      stored: true,
      expiresAt: stored.expiresAt.toISOString(),
      expiresInSeconds,
      isExpired: expiresInSeconds === 0,
      scope: stored.scope,
      tokenType: stored.tokenType,
    };

    if (options?.introspect && expiresInSeconds > 0) {
      try {
        status.introspection = await this.introspectToken(
          stored.accessToken,
          'access_token',
        );
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : String(error);
        status.introspectionError = detail;
      }
    }

    return status;
  }

  private toTokenSummary(data: PrithviOAuthTokenData) {
    return {
      provider: this.provider,
      stored: true,
      expiresIn: data.expires_in,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      scope: data.scope,
      tokenType: data.token_type,
    };
  }

  private requireConfig(key: 'PRITHVI_BASE_URL' | 'PRITHVI_CLIENT_ID' | 'PRITHVI_CLIENT_SECRET' | 'PRITHVI_AGENT_ID'): string {
    const value = this.config.get(key);
    if (!value) {
      this.logger.error(`Prithvi Exchange is active but ${key} is missing.`);
      throw new InternalServerErrorException(
        'Prithvi Exchange provider is not configured correctly.',
      );
    }
    return value;
  }

  private buildUrl(path: string): string {
    const baseUrl = this.requireConfig('PRITHVI_BASE_URL').replace(/\/$/, '');
    return `${baseUrl}${path}`;
  }

  private postForm<T>(
    path: string,
    body: URLSearchParams,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    return this.httpForm.postFormWithSuccessEnvelope<T>({
      url: this.buildUrl(path),
      body,
      headers: extraHeaders,
      context: path,
      errorMessage:
        'Prithvi Exchange request failed. Please try again later.',
    });
  }
}
