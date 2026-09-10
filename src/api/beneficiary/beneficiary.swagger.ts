import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

import { CreateBeneficiaryDto } from './dto';

export function ListBeneficiariesSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'List beneficiaries for the logged-in user',
      description:
        'Finpay app users see their own beneficiaries. Agents must pass agentCustomerId to list beneficiaries for one of their walk-in customers.',
    }),
    ApiQuery({
      name: 'agentCustomerId',
      required: false,
      description: 'Required for agents — walk-in customer id',
    }),
    ApiResponse({ status: 200, description: 'Beneficiaries list' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

export function CreateBeneficiarySwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Create a beneficiary',
      description:
        'Saves a new TT beneficiary. Agents must include agentCustomerId so the beneficiary belongs to a specific walk-in customer (not a shared agent-wide list).',
    }),
    ApiBody({ type: CreateBeneficiaryDto }),
    ApiResponse({ status: 201, description: 'Beneficiary created' }),
    ApiResponse({ status: 400, description: 'Validation error' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}
