import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

import {
  PrithviOrderType,
  PrithviProductType,
} from 'src/services/prithvi-exchange';
import { RemittanceProvider } from 'src/utils/enums/remittance-provider.enum';
import { RemittanceProviderDto, RemittanceRateResponseDto } from './dto';
import {
  ProviderTokenActionResponseDto,
  ProviderTokenStatusResponseDto,
} from './dto/provider-token.dto';

export function GetRemittanceProvidersSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'List remittance providers (public)',
      description:
        'Returns configured remittance service providers and their active status.',
    }),
    ApiResponse({
      status: 200,
      description: 'Providers retrieved successfully',
      type: RemittanceProviderDto,
      isArray: true,
    }),
  );
}

export function GetRemittanceRatesSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get cached remittance FX rates (public)',
      description:
        'Returns agent FX rates from the MongoDB cache. Rates are synced from Prithvi at 9:00 AM and 6:00 PM IST.',
    }),
    ApiQuery({ name: 'orderType', enum: PrithviOrderType, required: true }),
    ApiQuery({ name: 'productType', enum: PrithviProductType, required: true }),
    ApiQuery({ name: 'agentId', required: false }),
    ApiResponse({
      status: 200,
      description: 'Rates retrieved successfully',
      type: RemittanceRateResponseDto,
    }),
    ApiResponse({ status: 400, description: 'Validation failure' }),
    ApiResponse({ status: 429, description: 'Too many requests' }),
  );
}

export function ObtainProviderTokenSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtain OAuth token for a remittance provider (admin)',
      description:
        'Calls the provider OAuth API (client credentials), stores access + refresh tokens in MongoDB, and returns expiry metadata. **Authorize with Bearer JWT** (from POST /api/v1/auth/login) before calling. Raw tokens are not returned in the response.',
    }),
    ApiParam({
      name: 'provider',
      enum: RemittanceProvider,
      example: RemittanceProvider.PRITHVI,
    }),
    ApiResponse({
      status: 201,
      description: 'Token obtained and stored',
      type: ProviderTokenActionResponseDto,
    }),
    ApiResponse({ status: 400, description: 'Unknown provider' }),
    ApiResponse({ status: 401, description: 'Unauthorized — Bearer JWT required' }),
  );
}

export function RefreshProviderTokenSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Refresh OAuth token for a remittance provider (admin)',
      description:
        'Uses the stored refresh token to rotate credentials via the provider API. **Authorize with Bearer JWT** before calling.',
    }),
    ApiParam({
      name: 'provider',
      enum: RemittanceProvider,
      example: RemittanceProvider.PRITHVI,
    }),
    ApiResponse({
      status: 200,
      description: 'Token refreshed and stored',
      type: ProviderTokenActionResponseDto,
    }),
    ApiResponse({ status: 400, description: 'Unknown provider' }),
    ApiResponse({ status: 401, description: 'Unauthorized — Bearer JWT required' }),
  );
}

export function GetProviderTokenStatusSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Check stored OAuth token status (admin)',
      description:
        'Returns whether a token exists in DB, expiry info, and optional live validation via provider introspect API. **Authorize with Bearer JWT** before calling.',
    }),
    ApiParam({
      name: 'provider',
      enum: RemittanceProvider,
      example: RemittanceProvider.PRITHVI,
    }),
    ApiQuery({
      name: 'introspect',
      required: false,
      type: Boolean,
      description: 'Set to true to validate the token against the provider API',
    }),
    ApiResponse({
      status: 200,
      description: 'Token status retrieved',
      type: ProviderTokenStatusResponseDto,
    }),
    ApiResponse({ status: 400, description: 'Unknown provider' }),
    ApiResponse({ status: 401, description: 'Unauthorized — Bearer JWT required' }),
  );
}
