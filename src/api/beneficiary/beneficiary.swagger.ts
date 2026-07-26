import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { CreateBeneficiaryDto } from './dto';

export function ListBeneficiariesSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'List beneficiaries for the logged-in user',
      description:
        'Returns TT transfer beneficiaries saved by the authenticated user.',
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
        'Saves a new TT beneficiary for the authenticated user. Interim bank fields are required when isInterimBankSelected is true.',
    }),
    ApiBody({ type: CreateBeneficiaryDto }),
    ApiResponse({ status: 201, description: 'Beneficiary created' }),
    ApiResponse({ status: 400, description: 'Validation error' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}
