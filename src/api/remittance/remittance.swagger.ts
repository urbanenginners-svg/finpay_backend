import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

import {
  PrithviForexRequestStatus,
  PrithviOrderType,
  PrithviProductType,
} from 'src/services/prithvi-exchange';
import { RemittanceProvider } from 'src/utils/enums/remittance-provider.enum';
import {
  CompleteForexRequestDto,
  InitiateForexRequestDto,
  RemittanceProviderDto,
  RemittanceRateResponseDto,
} from './dto';
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
        'Returns agent FX rates from the MongoDB cache. On cache miss, fetches once from Prithvi and stores the result. Scheduled refresh at 9:00 AM and 6:00 PM IST.',
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

export function InitiateForexRequestSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Initiate forex request (Step 1)',
      description:
        'Reserves inventory and creates a DRAFT booking with locked rates for 20 minutes. Proxies to Prithvi POST /forex/initiate.',
    }),
    ApiBody({ type: InitiateForexRequestDto }),
    ApiResponse({ status: 201, description: 'Forex draft created' }),
    ApiResponse({ status: 400, description: 'Validation or provider client error' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

export function CompleteForexRequestSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Complete forex request (Step 2)',
      description:
        'Finalizes a DRAFT booking with traveler, PAN, travel, and delivery details. Must occur within the 20-minute rate lock. Proxies to Prithvi POST /forex/:id/complete.',
    }),
    ApiParam({
      name: 'id',
      description: 'Forex draft request UUID from Step 1',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiBody({ type: CompleteForexRequestDto }),
    ApiResponse({ status: 200, description: 'Forex request submitted for approval' }),
    ApiResponse({ status: 400, description: 'Validation or expired session' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

export function GetForexOrdersDashboardSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Forex orders dashboard',
      description:
        'Paginated booking history from Prithvi. Filter by status, product, or date range.',
    }),
    ApiQuery({ name: 'pageNumber', required: false, type: Number }),
    ApiQuery({ name: 'pageSize', required: false, type: Number }),
    ApiQuery({
      name: 'status',
      required: false,
      enum: PrithviForexRequestStatus,
    }),
    ApiQuery({ name: 'product', required: false, enum: PrithviProductType }),
    ApiQuery({ name: 'fromDate', required: false, example: '2026-05-01' }),
    ApiQuery({ name: 'toDate', required: false, example: '2026-05-31' }),
    ApiResponse({ status: 200, description: 'Orders retrieved' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

export function GetPurposesSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'List LRS purpose categories (public)',
      description:
        'Returns Liberalised Remittance Scheme purpose codes from Prithvi for the selected order/product context.',
    }),
    ApiQuery({ name: 'orderType', required: false, enum: PrithviOrderType }),
    ApiQuery({ name: 'productType', required: false, enum: PrithviProductType }),
    ApiResponse({ status: 200, description: 'Purposes retrieved' }),
  );
}

export function GetPurposeConfigSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get purpose KYC / product config (public)',
      description:
        'Returns required documents and allowed products for a purpose code.',
    }),
    ApiParam({ name: 'code', example: 'S0001' }),
    ApiResponse({ status: 200, description: 'Purpose config retrieved' }),
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
