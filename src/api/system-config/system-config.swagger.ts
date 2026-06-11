import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

export function BulkUpsertPricingSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Bulk create or update cross-country pricing',
      description:
        'Upserts one document per country pair. Each item stores both directions: ' +
        'countryAPricing (A→B) and countryBPricing (B→A). ' +
        'Set isActive to false to hide a pair from the public GET API (defaults to true). ' +
        'Existing pairs are updated; new pairs are created. Requires organisation API-key headers.',
    }),
    ApiResponse({ status: 200, description: 'Pricing configs saved successfully' }),
    ApiResponse({ status: 400, description: 'Validation failure' }),
    ApiResponse({ status: 401, description: 'Invalid or missing API key credentials' }),
  );
}

export function GetPricingConfigSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get cross-country pricing',
      description:
        'Returns pricing for a specific country pair when countryAName and countryBName are provided, ' +
        'otherwise returns all active pricing configs. Inactive pairs (isActive: false) are excluded. Public route; no authentication required.',
    }),
    ApiQuery({ name: 'countryAName', required: false, example: 'India' }),
    ApiQuery({ name: 'countryBName', required: false, example: 'United States' }),
    ApiResponse({ status: 200, description: 'Pricing config(s) retrieved successfully' }),
    ApiResponse({ status: 404, description: 'Pricing config not found' }),
  );
}
