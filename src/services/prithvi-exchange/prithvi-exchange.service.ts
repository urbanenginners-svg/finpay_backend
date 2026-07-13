import axios, { isAxiosError } from 'axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { AppConfigService } from 'src/services/env/env.service';
import { RemittanceProviderTokenService } from 'src/services/remittance-provider-token';
import { RemittanceProvider } from 'src/utils/enums/remittance-provider.enum';
import {
  PRITHVI_API_PATHS,
  PRITHVI_DEFAULT_SCOPE,
  PRITHVI_TOKEN_REFRESH_BUFFER_MS,
} from './prithvi-exchange.constants';
import { PrithviAgentRatesCacheService } from './prithvi-agent-rates-cache.service';
import {
  buildDryRunAgentRates,
  parsePrithviAgentRatesResponse,
} from './prithvi-exchange-rates.helper';
import { PrithviApiLogService } from './prithvi-api-log.service';
import {
  PrithviOrderType,
  PrithviProductType,
  type CachedPrithviAgentRatesResult,
  type GetAgentRatesParams,
  PrithviAgentRatesRawData,
  PrithviAgentRatesResult,
  PrithviApiResponse,
  PrithviOAuthTokenData,
  PrithviPanVerificationData,
  PrithviPassportVerificationData,
  PrithviTokenIntrospectionData,
  VerifyPanNumberParams,
  VerifyPassportParams,
} from './prithvi-exchange.types';
import { PrithviApiCallType } from './prithvi-exchange.types';

/** Form fields and response keys that must never appear in logs in plain text. */
const SENSITIVE_KEYS = new Set([
  'client_secret',
  'access_token',
  'refresh_token',
  'token',
]);

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'x-api-key',
  'api-key',
]);

const REDACTED = '[REDACTED]';

@Injectable()
export class PrithviExchangeService {
  private readonly logger = new Logger(PrithviExchangeService.name);
  private readonly provider = RemittanceProvider.PRITHVI;

  constructor(
    private readonly config: AppConfigService,
    private readonly tokenStore: RemittanceProviderTokenService,
    private readonly apiLog: PrithviApiLogService,
    private readonly ratesCache: PrithviAgentRatesCacheService,
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

    const response = await this.postFormLogged<PrithviOAuthTokenData>(
      PrithviApiCallType.OAUTH_TOKEN,
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
      const response = await this.postFormLogged<PrithviOAuthTokenData>(
        PrithviApiCallType.OAUTH_REFRESH,
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

    return this.postFormLogged<PrithviTokenIntrospectionData>(
      PrithviApiCallType.OAUTH_INTROSPECT,
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

    await this.postFormLogged<void>(
      PrithviApiCallType.OAUTH_REVOKE,
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
   * Return cached agent FX rates (no outbound Prithvi call).
   * Populated by the 9 AM / 6 PM IST cron via {@link syncAgentRatesFromProvider}.
   */
  async getAgentRates(params: GetAgentRatesParams): Promise<CachedPrithviAgentRatesResult> {
    const agentId = this.resolveAgentId(params.agentId);
    const cached = await this.ratesCache.findByAgentId(agentId);

    if (cached) {
      return {
        message: cached.message ?? undefined,
        source: cached.source ?? undefined,
        timestamp: cached.providerTimestamp,
        currencies: cached.currencies,
        fetchedAt: cached.fetchedAt.toISOString(),
        fromCache: true,
      };
    }

    if (!this.isActive) {
      const dryRunResult = buildDryRunAgentRates();
      return {
        ...dryRunResult,
        fetchedAt: new Date().toISOString(),
        fromCache: true,
      };
    }

    throw new ServiceUnavailableException(
      'FX rates are not available yet. Rates sync automatically at 9:00 AM and 6:00 PM IST.',
    );
  }

  /**
   * Fetch live rates from Prithvi and persist to MongoDB.
   * Called by scheduled cron — not on user-facing requests.
   */
  async syncAgentRatesFromProvider(agentId?: string): Promise<PrithviAgentRatesResult> {
    const resolvedAgentId = this.resolveAgentId(agentId);
    const fetchParams: GetAgentRatesParams = {
      agentId: resolvedAgentId,
      orderType: PrithviOrderType.BUY,
      productType: PrithviProductType.CASH,
    };

    const rates = this.isActive
      ? await this.fetchLiveAgentRates(fetchParams)
      : buildDryRunAgentRates();

    await this.ratesCache.upsert({
      agentId: resolvedAgentId,
      rates,
      isDryRun: !this.isActive,
    });

    this.logger.log(
      `Prithvi agent rates synced for agentId=${resolvedAgentId} (${rates.currencies.length} currencies, dryRun=${!this.isActive}).`,
    );
    return rates;
  }

  private resolveAgentId(agentId?: string): string {
    return agentId ?? this.requireConfig('PRITHVI_AGENT_ID');
  }

  /** Returns configured agent ID when set, without throwing. */
  getConfiguredAgentId(): string | null {
    const agentId = this.config.get('PRITHVI_AGENT_ID');
    return agentId?.trim() ? agentId.trim() : null;
  }

  /** Outbound HTTP call to Prithvi — use only from cron / sync. */
  private async fetchLiveAgentRates(
    params: GetAgentRatesParams,
  ): Promise<PrithviAgentRatesResult> {
    const agentId = params.agentId ?? this.requireConfig('PRITHVI_AGENT_ID');
    const url = this.buildUrl(PRITHVI_API_PATHS.AGENT_RATES);
    const requestParams = {
      agentId,
      orderType: params.orderType,
      productType: params.productType,
    };
    const startedAt = Date.now();
    let httpStatus: number | null = null;
    let responseBody: Record<string, unknown> | null = null;
    let requestHeaders: Record<string, unknown> | null = null;
    let success = false;
    let errorMessage: string | null = null;

    try {
      const buildRatesHeaders = (accessToken: string) => ({
        Authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      });

      const fetchRates = (accessToken: string) =>
        axios.get<PrithviApiResponse<PrithviAgentRatesRawData>>(url, {
          params: {
            agentId,
            order_type: params.orderType,
            product_type: params.productType,
          },
          headers: buildRatesHeaders(accessToken),
          validateStatus: () => true,
        });

      let accessToken = await this.getValidAccessToken();
      requestHeaders = this.sanitizeHeaders(buildRatesHeaders(accessToken));
      let response = await fetchRates(accessToken);

      if (this.isAuthTokenRejected(response.status, response.data)) {
        this.logger.warn(
          'Prithvi rates received 401; refreshing OAuth token and retrying once.',
        );
        accessToken = await this.getValidAccessToken({ forceRefresh: true });
        requestHeaders = this.sanitizeHeaders(buildRatesHeaders(accessToken));
        response = await fetchRates(accessToken);
      }

      httpStatus = response.status;
      responseBody = this.sanitizeObject(response.data as Record<string, unknown>);

      if (response.status < 200 || response.status >= 300) {
        errorMessage = `HTTP ${response.status}: ${JSON.stringify(response.data)}`;
        this.logger.error(
          `Prithvi rates HTTP ${response.status}: ${JSON.stringify(response.data)}`,
        );
        throw new InternalServerErrorException(
          'Unable to fetch live rates right now. Please try again later.',
        );
      }

      if (!response.data?.success) {
        errorMessage = `API error: ${JSON.stringify(response.data)}`;
        this.logger.error(
          `Prithvi rates API error: ${JSON.stringify(response.data)}`,
        );
        throw new InternalServerErrorException(
          'Unable to fetch live rates right now. Please try again later.',
        );
      }

      success = true;
      return parsePrithviAgentRatesResponse(response.data.data, {
        message: response.data.message,
        source: response.data.metadata?.source,
        timestamp: response.data.timestamp,
      });
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      errorMessage = isAxiosError(err)
        ? `Network error: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
      throw new InternalServerErrorException(
        'Unable to fetch live rates right now. Please try again later.',
      );
    } finally {
      void this.apiLog
        .create({
          callType: PrithviApiCallType.AGENT_RATES,
          method: 'GET',
          url,
          requestBody: null,
          requestParams,
          requestHeaders,
          httpStatus,
          responseBody,
          success,
          errorMessage,
          durationMs: Date.now() - startedAt,
          isDryRun: false,
        })
        .catch((e: unknown) =>
          this.logger.error(
            `Prithvi API log save failed: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
    }
  }

  /**
   * Validate passport details against the Prithvi verification API.
   */
  async verifyPassport(
    params: VerifyPassportParams,
  ): Promise<PrithviPassportVerificationData> {
    const requestBody = {
      file_number: params.fileNumber,
      name: params.name,
      dob: params.dob,
    };

    if (!this.isActive) {
      this.logger.warn(
        `PRITHVI_ACTIVE_MODE is not "true"; returning dry-run passport verification. fileNumber=${params.fileNumber}`,
      );
      const dryRunResult: PrithviPassportVerificationData = {
        passport_number: 'P1234567',
        name: params.name,
        status: 'VERIFIED',
      };
      void this.apiLog
        .create({
          callType: PrithviApiCallType.PASSPORT_VERIFY,
          method: 'POST',
          url: this.buildUrl(PRITHVI_API_PATHS.PASSPORT_VERIFY),
          requestBody: this.sanitizeObject(requestBody),
          requestParams: null,
          requestHeaders: this.sanitizeHeaders({
            Authorization: 'Bearer [REDACTED]',
            'Content-Type': 'application/json',
            accept: 'application/json',
          }),
          httpStatus: null,
          responseBody: dryRunResult as unknown as Record<string, unknown>,
          success: true,
          errorMessage: null,
          durationMs: 0,
          isDryRun: true,
        })
        .catch((e: unknown) =>
          this.logger.error(
            `Prithvi API log save failed: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
      return dryRunResult;
    }

    const accessToken = await this.getValidAccessToken();
    const url = this.buildUrl(PRITHVI_API_PATHS.PASSPORT_VERIFY);
    const startedAt = Date.now();
    let httpStatus: number | null = null;
    let responseBody: Record<string, unknown> | null = null;
    let requestHeaders: Record<string, unknown> | null = null;
    let success = false;
    let errorMessage: string | null = null;

    try {
      const buildPassportHeaders = (token: string) => ({
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        accept: 'application/json',
      });

      const verifyRequest = (token: string) =>
        axios.post<PrithviApiResponse<PrithviPassportVerificationData>>(
          url,
          requestBody,
          {
            headers: buildPassportHeaders(token),
            validateStatus: () => true,
          },
        );

      let token = accessToken;
      requestHeaders = this.sanitizeHeaders(buildPassportHeaders(token));
      let response = await verifyRequest(token);

      if (this.isAuthTokenRejected(response.status, response.data)) {
        this.logger.warn(
          'Prithvi passport verify received 401; refreshing OAuth token and retrying once.',
        );
        token = await this.getValidAccessToken({ forceRefresh: true });
        requestHeaders = this.sanitizeHeaders(buildPassportHeaders(token));
        response = await verifyRequest(token);
      }

      httpStatus = response.status;
      responseBody = this.sanitizeObject(response.data as Record<string, unknown>);

      if (response.status < 200 || response.status >= 300) {
        errorMessage = `HTTP ${response.status}: ${JSON.stringify(response.data)}`;
        this.logger.error(
          `Prithvi passport verify HTTP ${response.status}: ${JSON.stringify(response.data)}`,
        );
        throw new InternalServerErrorException(
          'Unable to verify passport right now. Please try again later.',
        );
      }

      if (!response.data?.success) {
        errorMessage = `API error: ${JSON.stringify(response.data)}`;
        this.logger.warn(
          `Prithvi passport verify API error: ${JSON.stringify(response.data)}`,
        );
        return {
          passport_number: '',
          name: params.name,
          status: 'FAILED',
        };
      }

      success = true;
      this.logger.log(
        `Prithvi passport verified: fileNumber=${params.fileNumber} status=${response.data.data.status}`,
      );
      return response.data.data;
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      errorMessage = isAxiosError(err)
        ? `Network error: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
      this.logger.error(`Prithvi passport verify failed: ${errorMessage}`);
      throw new InternalServerErrorException(
        'Unable to verify passport right now. Please try again later.',
      );
    } finally {
      void this.apiLog
        .create({
          callType: PrithviApiCallType.PASSPORT_VERIFY,
          method: 'POST',
          url,
          requestBody: this.sanitizeObject(requestBody),
          requestParams: null,
          requestHeaders,
          httpStatus,
          responseBody,
          success,
          errorMessage,
          durationMs: Date.now() - startedAt,
          isDryRun: false,
        })
        .catch((e: unknown) =>
          this.logger.error(
            `Prithvi API log save failed: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
    }
  }

  /**
   * Validate PAN details against the Prithvi verification API.
   */
  async verifyPanNumber(
    params: VerifyPanNumberParams,
  ): Promise<PrithviPanVerificationData> {
    const requestBody = {
      panNumber: params.panNumber,
      name: params.name,
    };

    if (!this.isActive) {
      this.logger.warn(
        `PRITHVI_ACTIVE_MODE is not "true"; returning dry-run PAN verification. panNumber=${params.panNumber}`,
      );
      const dryRunResult: PrithviPanVerificationData = {
        panNumber: params.panNumber,
        name: params.name,
        status: 'VERIFIED',
        registered_name: params.name.toUpperCase(),
      };
      void this.apiLog
        .create({
          callType: PrithviApiCallType.PAN_VERIFY,
          method: 'POST',
          url: this.buildUrl(PRITHVI_API_PATHS.PAN_VERIFY),
          requestBody: this.sanitizeObject(requestBody),
          requestParams: null,
          requestHeaders: this.sanitizeHeaders({
            Authorization: 'Bearer [REDACTED]',
            'Content-Type': 'application/json',
            accept: 'application/json',
          }),
          httpStatus: null,
          responseBody: dryRunResult as unknown as Record<string, unknown>,
          success: true,
          errorMessage: null,
          durationMs: 0,
          isDryRun: true,
        })
        .catch((e: unknown) =>
          this.logger.error(
            `Prithvi API log save failed: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
      return dryRunResult;
    }

    const accessToken = await this.getValidAccessToken();
    const url = this.buildUrl(PRITHVI_API_PATHS.PAN_VERIFY);
    const startedAt = Date.now();
    let httpStatus: number | null = null;
    let responseBody: Record<string, unknown> | null = null;
    let requestHeaders: Record<string, unknown> | null = null;
    let success = false;
    let errorMessage: string | null = null;

    try {
      const buildPanHeaders = (token: string) => ({
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        accept: 'application/json',
      });

      const verifyRequest = (token: string) =>
        axios.post<PrithviApiResponse<PrithviPanVerificationData>>(
          url,
          requestBody,
          {
            headers: buildPanHeaders(token),
            validateStatus: () => true,
          },
        );

      let token = accessToken;
      requestHeaders = this.sanitizeHeaders(buildPanHeaders(token));
      let response = await verifyRequest(token);

      if (this.isAuthTokenRejected(response.status, response.data)) {
        this.logger.warn(
          'Prithvi PAN verify received 401; refreshing OAuth token and retrying once.',
        );
        token = await this.getValidAccessToken({ forceRefresh: true });
        requestHeaders = this.sanitizeHeaders(buildPanHeaders(token));
        response = await verifyRequest(token);
      }

      httpStatus = response.status;
      responseBody = this.sanitizeObject(response.data as Record<string, unknown>);

      if (response.status < 200 || response.status >= 300) {
        errorMessage = `HTTP ${response.status}: ${JSON.stringify(response.data)}`;
        this.logger.error(
          `Prithvi PAN verify HTTP ${response.status}: ${JSON.stringify(response.data)}`,
        );
        throw new InternalServerErrorException(
          'Unable to verify PAN right now. Please try again later.',
        );
      }

      if (!response.data?.success) {
        errorMessage = `API error: ${JSON.stringify(response.data)}`;
        this.logger.warn(
          `Prithvi PAN verify API error: ${JSON.stringify(response.data)}`,
        );
        return {
          panNumber: params.panNumber,
          name: params.name,
          status: 'FAILED',
        };
      }

      success = true;
      this.logger.log(
        `Prithvi PAN verified: panNumber=${params.panNumber} status=${response.data.data.status}`,
      );
      return response.data.data;
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      errorMessage = isAxiosError(err)
        ? `Network error: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
      this.logger.error(`Prithvi PAN verify failed: ${errorMessage}`);
      throw new InternalServerErrorException(
        'Unable to verify PAN right now. Please try again later.',
      );
    } finally {
      void this.apiLog
        .create({
          callType: PrithviApiCallType.PAN_VERIFY,
          method: 'POST',
          url,
          requestBody: this.sanitizeObject(requestBody),
          requestParams: null,
          requestHeaders,
          httpStatus,
          responseBody,
          success,
          errorMessage,
          durationMs: Date.now() - startedAt,
          isDryRun: false,
        })
        .catch((e: unknown) =>
          this.logger.error(
            `Prithvi API log save failed: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
    }
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
   * Pass `forceRefresh: true` to bypass the cache (e.g. after a 401).
   */
  async getValidAccessToken(options?: {
    forceRefresh?: boolean;
  }): Promise<string> {
    if (!this.isActive) {
      throw new InternalServerErrorException(
        'Prithvi Exchange is not active. Set PRITHVI_ACTIVE_MODE=true to enable.',
      );
    }

    if (options?.forceRefresh) {
      return this.refreshAccessToken();
    }

    const stored = await this.tokenStore.findByProvider(this.provider);

    if (
      stored &&
      stored.expiresAt.getTime() - Date.now() > PRITHVI_TOKEN_REFRESH_BUFFER_MS
    ) {
      return stored.accessToken;
    }

    return this.refreshAccessToken();
  }

  /**
   * Refresh via refresh_token grant, falling back to client_credentials.
   */
  private async refreshAccessToken(): Promise<string> {
    const stored = await this.tokenStore.findByProvider(this.provider);

    if (stored?.refreshToken) {
      try {
        const data = await this.refreshOAuthToken();
        return data.access_token;
      } catch {
        this.logger.warn(
          'Prithvi refresh token grant failed; falling back to client credentials.',
        );
      }
    }

    const data = await this.obtainToken();
    return data.access_token;
  }

  /**
   * Detect 401 / INVALID_TOKEN responses that warrant a token refresh + retry.
   */
  private isAuthTokenRejected(status: number, data: unknown): boolean {
    if (status !== 401) {
      return false;
    }

    if (data && typeof data === 'object') {
      const error = (data as { error?: { code?: string; message?: string } }).error;
      if (error?.code === 'INVALID_TOKEN') {
        return true;
      }
      const message = error?.message?.toLowerCase() ?? '';
      if (
        message.includes('invalid') &&
        (message.includes('token') || message.includes('expired'))
      ) {
        return true;
      }
    }

    return true;
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

  private requireConfig(
    key:
      | 'PRITHVI_BASE_URL'
      | 'PRITHVI_CLIENT_ID'
      | 'PRITHVI_CLIENT_SECRET'
      | 'PRITHVI_AGENT_ID',
  ): string {
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

  /**
   * POST `application/x-www-form-urlencoded` to a Prithvi endpoint, unwrap the
   * `{ success, data }` envelope, and persist a full log entry regardless of
   * outcome.
   */
  private async postFormLogged<T>(
    callType: PrithviApiCallType,
    path: string,
    body: URLSearchParams,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const url = this.buildUrl(path);
    const requestHeaders = {
      'Content-Type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
      ...(extraHeaders ?? {}),
    };
    const startedAt = Date.now();
    let httpStatus: number | null = null;
    let responseBody: Record<string, unknown> | null = null;
    let success = false;
    let errorMessage: string | null = null;

    try {
      const raw = await axios.post<{ success: boolean; data: T }>(
        url,
        body.toString(),
        {
          headers: requestHeaders,
          validateStatus: () => true,
        },
      );

      httpStatus = raw.status;
      responseBody = this.sanitizeObject(raw.data as Record<string, unknown>);

      if (raw.status < 200 || raw.status >= 300) {
        errorMessage = `HTTP ${raw.status}: ${JSON.stringify(raw.data)}`;
        this.logger.error(`HTTP ${raw.status} [${path}]: ${JSON.stringify(raw.data)}`);
        throw new InternalServerErrorException(
          'Prithvi Exchange request failed. Please try again later.',
        );
      }

      if (!raw.data?.success) {
        errorMessage = `API error: ${JSON.stringify(raw.data)}`;
        this.logger.error(`API error [${path}]: ${JSON.stringify(raw.data)}`);
        throw new InternalServerErrorException(
          'Prithvi Exchange request failed. Please try again later.',
        );
      }

      success = true;
      return raw.data.data;
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      const detail = isAxiosError(err)
        ? JSON.stringify(err.response?.data ?? err.message)
        : err instanceof Error
          ? err.message
          : String(err);
      if (errorMessage === null) errorMessage = detail;
      this.logger.error(`Request failed [${path}]: ${detail}`);
      throw new InternalServerErrorException(
        'Prithvi Exchange request failed. Please try again later.',
      );
    } finally {
      void this.apiLog
        .create({
          callType,
          method: 'POST',
          url,
          requestBody: this.sanitizeUrlParams(body),
          requestParams: null,
          requestHeaders: this.sanitizeHeaders(requestHeaders),
          httpStatus,
          responseBody,
          success,
          errorMessage,
          durationMs: Date.now() - startedAt,
          isDryRun: false,
        })
        .catch((e: unknown) =>
          this.logger.error(
            `Prithvi API log save failed: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
    }
  }

  /**
   * Convert URLSearchParams to a plain object, replacing sensitive fields with
   * "[REDACTED]" so credentials never appear in the logs collection.
   */
  private sanitizeUrlParams(params: URLSearchParams): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    params.forEach((value, key) => {
      result[key] = SENSITIVE_KEYS.has(key) ? REDACTED : value;
    });
    return result;
  }

  /**
   * Clone request headers for storage, redacting Authorization and other
   * sensitive header values while preserving header names for debugging.
   */
  private sanitizeHeaders(
    headers: Record<string, string> | null | undefined,
  ): Record<string, unknown> | null {
    if (!headers) {
      return null;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_HEADERS.has(lowerKey)) {
        if (lowerKey === 'authorization' && value.toLowerCase().startsWith('bearer ')) {
          result[key] = 'Bearer [REDACTED]';
        } else {
          result[key] = REDACTED;
        }
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Shallow-clone a plain object, replacing any top-level key whose name is in
   * SENSITIVE_KEYS with "[REDACTED]".  Applied to both request bodies and
   * response bodies before storage.
   */
  private sanitizeObject(
    obj: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | null {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object' || Array.isArray(obj)) {
      return { value: obj };
    }
    const clone: Record<string, unknown> = { ...obj };
    for (const key of Object.keys(clone)) {
      if (SENSITIVE_KEYS.has(key)) {
        clone[key] = REDACTED;
      }
    }
    return clone;
  }
}
