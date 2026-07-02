import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

import {
  ServiceEnquiryResponseDto,
  ServiceOptionDto,
  SubmitEnquiryResponseDto,
} from './dto';

export function SubmitEnquirySwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Submit a service enquiry (public)',
      description:
        'Creates a new lead from the Service Enquiry Hub. No authentication required. Rate limited to 10 requests per minute per IP.',
    }),
    ApiResponse({
      status: 201,
      description: 'Enquiry submitted successfully',
      type: SubmitEnquiryResponseDto,
    }),
    ApiResponse({ status: 400, description: 'Validation failure' }),
    ApiResponse({ status: 422, description: 'Business rule failure' }),
    ApiResponse({ status: 429, description: 'Too many requests' }),
  );
}

export function GetServicesSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get available service types (public)',
      description: 'Returns supported serviceType values and display labels for frontend dropdowns.',
    }),
    ApiResponse({
      status: 200,
      description: 'Services retrieved successfully',
      type: ServiceOptionDto,
      isArray: true,
    }),
  );
}

export function GetEnquiriesSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'List service enquiries (admin/advisor)',
      description:
        'Paginated, filterable list of enquiries for advisor follow-up. Requires READ permission on Enquiry resource.',
    }),
    ApiQuery({ name: 'serviceType', required: false }),
    ApiQuery({ name: 'status', required: false }),
    ApiQuery({ name: 'isPriority', required: false, example: 'true' }),
    ApiQuery({ name: 'page', required: false, example: 1 }),
    ApiQuery({ name: 'limit', required: false, example: 10 }),
    ApiQuery({ name: 'q', required: false, description: 'Search name, email, mobile, or reference number' }),
    ApiResponse({
      status: 200,
      description: 'Enquiries retrieved successfully',
      type: ServiceEnquiryResponseDto,
      isArray: true,
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
  );
}

export function GetEnquiryByIdSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get enquiry by ID (admin/advisor)',
      description: 'Returns a single enquiry for ops/advisor dashboard. Requires READ permission on Enquiry resource.',
    }),
    ApiParam({ name: 'enquiryId', description: 'Enquiry ID' }),
    ApiResponse({
      status: 200,
      description: 'Enquiry retrieved successfully',
      type: ServiceEnquiryResponseDto,
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
    ApiResponse({ status: 404, description: 'Enquiry not found' }),
  );
}

export function UpdateEnquirySwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Update enquiry status and add admin notes',
      description:
        'Allows admins to change enquiry status and append conversation notes. Requires UPDATE permission on Enquiry resource.',
    }),
    ApiParam({ name: 'enquiryId', description: 'Enquiry ID' }),
    ApiResponse({
      status: 200,
      description: 'Enquiry updated successfully',
      type: ServiceEnquiryResponseDto,
    }),
    ApiResponse({ status: 400, description: 'Validation failure' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
    ApiResponse({ status: 404, description: 'Enquiry not found' }),
  );
}
