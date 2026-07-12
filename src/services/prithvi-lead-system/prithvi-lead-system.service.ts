import axios, { isAxiosError } from 'axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { AppConfigService } from 'src/services/env/env.service';
import { RemittanceProviderTokenService } from 'src/services/remittance-provider-token';
import { RemittanceProvider } from 'src/utils/enums/remittance-provider.enum';
import {
  PRITHVI_LEAD_SYSTEM_API_PATHS,
  PRITHVI_LEAD_SYSTEM_DEFAULT_SCOPE,
  PRITHVI_LEAD_SYSTEM_TOKEN_REFRESH_BUFFER_MS,
} from './prithvi-lead-system.constants';
import { PrithviLeadSystemApiLogService } from './prithvi-lead-system-api-log.service';
import type {
  PrithviLeadSystemApiResponse,
  PrithviLeadSystemOAuthTokenData,
  PrithviLeadSystemPanInnerResult,
  PrithviLeadSystemPanVerificationData,
  PrithviLeadSystemPassportInnerResult,
  PrithviLeadSystemPassportVerificationData,
  PrithviLeadSystemTokenIntrospectionData,
  PrithviLeadSystemVerificationEnvelope,
  VerifyPanNumberParams,
  VerifyPassportParams,
} from './prithvi-lead-system.types';
import { PrithviLeadSystemApiCallType } from './prithvi-lead-system.types';

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
export class PrithviLeadSystemService {
  private readonly logger = new Logger(PrithviLeadSystemService.name);
  private readonly provider = RemittanceProvider.PRITHVI_LEAD_SYSTEM;

  constructor(
    private readonly config: AppConfigService,
    private readonly tokenStore: RemittanceProviderTokenService,
    private readonly apiLog: PrithviLeadSystemApiLogService,
  ) {}

  get isActive(): boolean {
    return this.config.get('PRITHVI_LEAD_SYSTEM_ACTIVE_MODE') === 'true';
  }

  async obtainToken(scope?: string): Promise<PrithviLeadSystemOAuthTokenData> {
    const clientId = this.requireConfig('PRITHVI_LEAD_SYSTEM_CLIENT_ID');
    const clientSecret = this.requireConfig('PRITHVI_LEAD_SYSTEM_CLIENT_SECRET');

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope:
        scope ??
        this.config.get('PRITHVI_LEAD_SYSTEM_SCOPE') ??
        PRITHVI_LEAD_SYSTEM_DEFAULT_SCOPE,
    });

    const response = await this.postFormLogged<PrithviLeadSystemOAuthTokenData>(
      PrithviLeadSystemApiCallType.OAUTH_TOKEN,
      PRITHVI_LEAD_SYSTEM_API_PATHS.OAUTH_TOKEN,
      body,
    );

    await this.cacheTokens(response);
    this.logger.log('Prithvi Lead System OAuth token obtained successfully.');
    return response;
  }

  async refreshOAuthToken(
    refreshToken?: string,
  ): Promise<PrithviLeadSystemOAuthTokenData> {
    const clientId = this.requireConfig('PRITHVI_LEAD_SYSTEM_CLIENT_ID');
    const clientSecret = this.requireConfig('PRITHVI_LEAD_SYSTEM_CLIENT_SECRET');
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
      const response =
        await this.postFormLogged<PrithviLeadSystemOAuthTokenData>(
          PrithviLeadSystemApiCallType.OAUTH_REFRESH,
          PRITHVI_LEAD_SYSTEM_API_PATHS.OAUTH_REFRESH,
          body,
        );

      await this.cacheTokens(response);
      this.logger.log('Prithvi Lead System OAuth token refreshed successfully.');
      return response;
    } catch {
      this.logger.warn(
        'Prithvi Lead System refresh token failed; falling back to client credentials grant.',
      );
      return this.obtainToken();
    }
  }

  async introspectToken(
    token: string,
    tokenTypeHint?: 'access_token' | 'refresh_token',
  ): Promise<PrithviLeadSystemTokenIntrospectionData> {
    const accessToken = await this.getValidAccessToken();

    const body = new URLSearchParams({ token });
    if (tokenTypeHint) {
      body.set('token_type_hint', tokenTypeHint);
    }

    return this.postFormLogged<PrithviLeadSystemTokenIntrospectionData>(
      PrithviLeadSystemApiCallType.OAUTH_INTROSPECT,
      PRITHVI_LEAD_SYSTEM_API_PATHS.OAUTH_INTROSPECT,
      body,
      { Authorization: `Bearer ${accessToken}` },
    );
  }

  async revokeToken(token: string): Promise<void> {
    const accessToken = await this.getValidAccessToken();

    const body = new URLSearchParams({ token });

    await this.postFormLogged<void>(
      PrithviLeadSystemApiCallType.OAUTH_REVOKE,
      PRITHVI_LEAD_SYSTEM_API_PATHS.OAUTH_REVOKE,
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

    this.logger.log('Prithvi Lead System token revoked successfully.');
  }

  async verifyPassport(
    params: VerifyPassportParams,
  ): Promise<PrithviLeadSystemPassportVerificationData> {
    const requestBody = {
      file_number: params.fileNumber,
      name: params.name,
      dob: params.dob,
    };

    if (!this.isActive) {
      this.logger.warn(
        `PRITHVI_LEAD_SYSTEM_ACTIVE_MODE is not "true"; returning dry-run passport verification. fileNumber=${params.fileNumber}`,
      );
      const dryRunResult: PrithviLeadSystemPassportVerificationData = {
        success: true,
        verificationId: 'dry-run',
        name_provided: params.name,
        passport_number: 'P1234567',
      };
      void this.apiLog
        .create({
          callType: PrithviLeadSystemApiCallType.PASSPORT_VERIFY,
          method: 'POST',
          url: this.buildUrl(PRITHVI_LEAD_SYSTEM_API_PATHS.PASSPORT_VERIFY),
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
            `Prithvi Lead System API log save failed: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
      return dryRunResult;
    }

    const accessToken = await this.getValidAccessToken();
    const url = this.buildUrl(PRITHVI_LEAD_SYSTEM_API_PATHS.PASSPORT_VERIFY);
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
        axios.post<
          PrithviLeadSystemApiResponse<
            PrithviLeadSystemVerificationEnvelope<PrithviLeadSystemPassportInnerResult>
          >
        >(url, requestBody, {
          headers: buildPassportHeaders(token),
          validateStatus: () => true,
        });

      let token = accessToken;
      requestHeaders = this.sanitizeHeaders(buildPassportHeaders(token));
      let response = await verifyRequest(token);

      if (this.isAuthTokenRejected(response.status, response.data)) {
        this.logger.warn(
          'Prithvi Lead System passport verify received 401; refreshing OAuth token and retrying once.',
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
          `Prithvi Lead System passport verify HTTP ${response.status}: ${JSON.stringify(response.data)}`,
        );
        throw new InternalServerErrorException(
          'Unable to verify passport right now. Please try again later.',
        );
      }

      if (!response.data?.success) {
        errorMessage = `API error: ${JSON.stringify(response.data)}`;
        this.logger.warn(
          `Prithvi Lead System passport verify API error: ${JSON.stringify(response.data)}`,
        );
        return this.failedPassportVerification(params);
      }

      const parsed = this.parsePassportVerificationResponse(
        response.data,
        params,
      );

      success = true;
      this.logger.log(
        `Prithvi Lead System passport verified: fileNumber=${params.fileNumber} success=${parsed.success} verificationId=${parsed.verificationId}`,
      );
      return parsed;
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      errorMessage = isAxiosError(err)
        ? `Network error: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
      this.logger.error(
        `Prithvi Lead System passport verify failed: ${errorMessage}`,
      );
      throw new InternalServerErrorException(
        'Unable to verify passport right now. Please try again later.',
      );
    } finally {
      void this.apiLog
        .create({
          callType: PrithviLeadSystemApiCallType.PASSPORT_VERIFY,
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
            `Prithvi Lead System API log save failed: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
    }
  }

  async verifyPanNumber(
    params: VerifyPanNumberParams,
  ): Promise<PrithviLeadSystemPanVerificationData> {
    const requestBody = {
      panNumber: params.panNumber,
      name: params.name,
    };

    if (!this.isActive) {
      this.logger.warn(
        `PRITHVI_LEAD_SYSTEM_ACTIVE_MODE is not "true"; returning dry-run PAN verification. panNumber=${params.panNumber}`,
      );
      const dryRunResult: PrithviLeadSystemPanVerificationData = {
        success: true,
        verificationId: 'dry-run',
        name_provided: params.name,
        registered_name: params.name.toUpperCase(),
      };
      void this.apiLog
        .create({
          callType: PrithviLeadSystemApiCallType.PAN_VERIFY,
          method: 'POST',
          url: this.buildUrl(PRITHVI_LEAD_SYSTEM_API_PATHS.PAN_VERIFY),
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
            `Prithvi Lead System API log save failed: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
      return dryRunResult;
    }

    const accessToken = await this.getValidAccessToken();
    const url = this.buildUrl(PRITHVI_LEAD_SYSTEM_API_PATHS.PAN_VERIFY);
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
        axios.post<
          PrithviLeadSystemApiResponse<
            PrithviLeadSystemVerificationEnvelope<PrithviLeadSystemPanInnerResult>
          >
        >(url, requestBody, {
          headers: buildPanHeaders(token),
          validateStatus: () => true,
        });

      let token = accessToken;
      requestHeaders = this.sanitizeHeaders(buildPanHeaders(token));
      let response = await verifyRequest(token);

      if (this.isAuthTokenRejected(response.status, response.data)) {
        this.logger.warn(
          'Prithvi Lead System PAN verify received 401; refreshing OAuth token and retrying once.',
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
          `Prithvi Lead System PAN verify HTTP ${response.status}: ${JSON.stringify(response.data)}`,
        );
        throw new InternalServerErrorException(
          'Unable to verify PAN right now. Please try again later.',
        );
      }

      if (!response.data?.success) {
        errorMessage = `API error: ${JSON.stringify(response.data)}`;
        this.logger.warn(
          `Prithvi Lead System PAN verify API error: ${JSON.stringify(response.data)}`,
        );
        return this.failedPanVerification(params);
      }

      const parsed = this.parsePanVerificationResponse(response.data, params);

      success = true;
      this.logger.log(
        `Prithvi Lead System PAN verified: panNumber=${params.panNumber} success=${parsed.success} verificationId=${parsed.verificationId}`,
      );
      return parsed;
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      errorMessage = isAxiosError(err)
        ? `Network error: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
      this.logger.error(
        `Prithvi Lead System PAN verify failed: ${errorMessage}`,
      );
      throw new InternalServerErrorException(
        'Unable to verify PAN right now. Please try again later.',
      );
    } finally {
      void this.apiLog
        .create({
          callType: PrithviLeadSystemApiCallType.PAN_VERIFY,
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
            `Prithvi Lead System API log save failed: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
    }
  }

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
    if (msUntilExpiry <= PRITHVI_LEAD_SYSTEM_TOKEN_REFRESH_BUFFER_MS) {
      await this.refreshOAuthToken();
    }
  }

  async getValidAccessToken(options?: {
    forceRefresh?: boolean;
  }): Promise<string> {
    if (!this.isActive) {
      throw new InternalServerErrorException(
        'Prithvi Lead System is not active. Set PRITHVI_LEAD_SYSTEM_ACTIVE_MODE=true to enable.',
      );
    }

    if (options?.forceRefresh) {
      return this.refreshAccessToken();
    }

    const stored = await this.tokenStore.findByProvider(this.provider);

    if (
      stored &&
      stored.expiresAt.getTime() - Date.now() >
        PRITHVI_LEAD_SYSTEM_TOKEN_REFRESH_BUFFER_MS
    ) {
      return stored.accessToken;
    }

    return this.refreshAccessToken();
  }

  private failedPanVerification(
    params: VerifyPanNumberParams,
  ): PrithviLeadSystemPanVerificationData {
    return {
      success: false,
      verificationId: '',
      name_provided: params.name,
      registered_name: '',
    };
  }

  private failedPassportVerification(
    params: VerifyPassportParams,
  ): PrithviLeadSystemPassportVerificationData {
    return {
      success: false,
      verificationId: '',
      name_provided: params.name,
      passport_number: '',
    };
  }

  private parsePanVerificationResponse(
    envelope: PrithviLeadSystemApiResponse<
      PrithviLeadSystemVerificationEnvelope<PrithviLeadSystemPanInnerResult>
    >,
    params: VerifyPanNumberParams,
  ): PrithviLeadSystemPanVerificationData {
    const wrapper = envelope.data;
    const inner = wrapper?.data;

    return {
      success: inner?.success ?? false,
      verificationId: wrapper?.verificationId ?? '',
      name_provided: inner?.name_provided ?? params.name,
      registered_name: inner?.registered_name ?? '',
      source: wrapper?.source,
    };
  }

  private parsePassportVerificationResponse(
    envelope: PrithviLeadSystemApiResponse<
      PrithviLeadSystemVerificationEnvelope<PrithviLeadSystemPassportInnerResult>
    >,
    params: VerifyPassportParams,
  ): PrithviLeadSystemPassportVerificationData {
    const wrapper = envelope.data;
    const inner = wrapper?.data;

    return {
      success: inner?.success ?? false,
      verificationId: wrapper?.verificationId ?? '',
      name_provided: inner?.name_provided ?? params.name,
      passport_number: inner?.passport_number ?? '',
      registered_name: inner?.registered_name,
      source: wrapper?.source,
    };
  }

  private async refreshAccessToken(): Promise<string> {
    const stored = await this.tokenStore.findByProvider(this.provider);

    if (stored?.refreshToken) {
      try {
        const data = await this.refreshOAuthToken();
        return data.access_token;
      } catch {
        this.logger.warn(
          'Prithvi Lead System refresh token grant failed; falling back to client credentials.',
        );
      }
    }

    const data = await this.obtainToken();
    return data.access_token;
  }

  private isAuthTokenRejected(status: number, data: unknown): boolean {
    if (status !== 401) {
      return false;
    }

    if (data && typeof data === 'object') {
      const error = (data as { error?: { code?: string; message?: string } })
        .error;
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

  private async cacheTokens(data: PrithviLeadSystemOAuthTokenData): Promise<void> {
    await this.tokenStore.upsert({
      provider: this.provider,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
      scope: data.scope,
    });
  }

  private requireConfig(
    key:
      | 'PRITHVI_LEAD_SYSTEM_BASE_URL'
      | 'PRITHVI_LEAD_SYSTEM_CLIENT_ID'
      | 'PRITHVI_LEAD_SYSTEM_CLIENT_SECRET',
  ): string {
    const value = this.config.get(key);
    if (!value) {
      this.logger.error(
        `Prithvi Lead System is active but ${key} is missing.`,
      );
      throw new InternalServerErrorException(
        'Prithvi Lead System provider is not configured correctly.',
      );
    }
    return value;
  }

  private buildUrl(path: string): string {
    const baseUrl = this.requireConfig('PRITHVI_LEAD_SYSTEM_BASE_URL').replace(
      /\/$/,
      '',
    );
    return `${baseUrl}${path}`;
  }

  private async postFormLogged<T>(
    callType: PrithviLeadSystemApiCallType,
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
        this.logger.error(
          `HTTP ${raw.status} [${path}]: ${JSON.stringify(raw.data)}`,
        );
        throw new InternalServerErrorException(
          'Prithvi Lead System request failed. Please try again later.',
        );
      }

      if (!raw.data?.success) {
        errorMessage = `API error: ${JSON.stringify(raw.data)}`;
        this.logger.error(`API error [${path}]: ${JSON.stringify(raw.data)}`);
        throw new InternalServerErrorException(
          'Prithvi Lead System request failed. Please try again later.',
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
        'Prithvi Lead System request failed. Please try again later.',
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
            `Prithvi Lead System API log save failed: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
    }
  }

  private sanitizeUrlParams(params: URLSearchParams): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    params.forEach((value, key) => {
      result[key] = SENSITIVE_KEYS.has(key) ? REDACTED : value;
    });
    return result;
  }

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
        if (
          lowerKey === 'authorization' &&
          value.toLowerCase().startsWith('bearer ')
        ) {
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
