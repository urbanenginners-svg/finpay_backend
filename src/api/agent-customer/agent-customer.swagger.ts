import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

import { CreateAgentCustomerDto, UpdateAgentCustomerDto } from './dto';

export function ListAgentCustomersSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'List agent walk-in customers',
      description:
        'Returns CRM customers owned by the logged-in agent only. These are not Finpay app users.',
    }),
    ApiQuery({
      name: 'search',
      required: false,
      description: 'Filter by name, phone, email, or PAN',
    }),
    ApiResponse({ status: 200, description: 'Customer list' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Not an agent' }),
  );
}

export function GetAgentCustomerSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Get one agent customer by id' }),
    ApiParam({ name: 'id', description: 'Agent customer id' }),
    ApiResponse({ status: 200, description: 'Customer' }),
    ApiResponse({ status: 404, description: 'Not found' }),
    ApiResponse({ status: 403, description: 'Not an agent' }),
  );
}

export function CreateAgentCustomerSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Create an agent walk-in customer',
      description:
        'Creates a reusable remitter profile for the agent. Does not register a Finpay login.',
    }),
    ApiBody({ type: CreateAgentCustomerDto }),
    ApiResponse({ status: 201, description: 'Customer created' }),
    ApiResponse({ status: 400, description: 'Validation error' }),
    ApiResponse({ status: 403, description: 'Not an agent' }),
  );
}

export function UpdateAgentCustomerSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Update an agent walk-in customer' }),
    ApiParam({ name: 'id', description: 'Agent customer id' }),
    ApiBody({ type: UpdateAgentCustomerDto }),
    ApiResponse({ status: 200, description: 'Customer updated' }),
    ApiResponse({ status: 404, description: 'Not found' }),
    ApiResponse({ status: 403, description: 'Not an agent' }),
  );
}

export function DeleteAgentCustomerSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Delete an agent walk-in customer' }),
    ApiParam({ name: 'id', description: 'Agent customer id' }),
    ApiResponse({ status: 200, description: 'Customer deleted' }),
    ApiResponse({ status: 404, description: 'Not found' }),
    ApiResponse({ status: 403, description: 'Not an agent' }),
  );
}
