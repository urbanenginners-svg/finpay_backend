import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

import {
  PrithviOrderType,
  PrithviProductType,
} from 'src/services/prithvi-exchange';
import { RemittanceRateResponseDto } from '../remittance/dto';

export function SyncAdminRatesSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Manually sync agent FX rates from Prithvi (admin)',
      description:
        'Fetches live agent FX rates from Prithvi, persists them to MongoDB, and returns sync metadata.',
    }),
    ApiQuery({
      name: 'agentId',
      required: false,
      description: 'Agent UUID. Defaults to PRITHVI_AGENT_ID from server config.',
    }),
    ApiResponse({
      status: 200,
      description: 'Rates synced successfully',
    }),
    ApiResponse({ status: 400, description: 'Validation failure' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
  );
}

export function GetAdminRatesSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get live agent FX rates (admin)',
      description:
        'Returns cached agent FX rates from MongoDB. On cache miss, fetches once from Prithvi and stores the result. Scheduled refresh every 5 minutes.',
    }),
    ApiQuery({ name: 'orderType', enum: PrithviOrderType, required: true }),
    ApiQuery({ name: 'productType', enum: PrithviProductType, required: true }),
    ApiQuery({
      name: 'agentId',
      required: false,
      description: 'Agent UUID. Defaults to PRITHVI_AGENT_ID from server config.',
    }),
    ApiResponse({
      status: 200,
      description: 'Rates retrieved successfully',
      type: RemittanceRateResponseDto,
    }),
    ApiResponse({ status: 400, description: 'Validation failure' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
  );
}
