import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { RoleResponseDto } from './dto';

export function CreateRoleSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Create a new role',
      description: 'Create a new role with a name, slug, optional description and optional permissions. Requires WRITE permission on Role resource.',
    }),
    ApiResponse({
      status: 201,
      description: 'Role created successfully',
      type: RoleResponseDto,
    }),
    ApiResponse({ status: 400, description: 'Bad Request - Invalid input data' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' }),
  );
}

export function UpdateRoleSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Update role permissions and description',
      description: 'Update the permissions and/or description of a role by its ID. Requires UPDATE permission on Role resource.',
    }),
    ApiParam({
      name: 'id',
      description: 'Role ID',
      example: 'role::123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'Role updated successfully',
      type: RoleResponseDto,
    }),
    ApiResponse({ status: 400, description: 'Bad Request - Invalid input data' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' }),
    ApiResponse({ status: 404, description: 'Not Found - Role not found' }),
  );
}

export function GetAllPermissionsSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get all permissions',
      description:
        'Retrieve a paginated list of all permissions. Supports search by slug, resource, or action. Requires READ permission on Permission resource.',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Number of items per page',
    }),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      description: 'Page number',
    }),
    ApiQuery({
      name: 'q',
      required: false,
      type: String,
      description: 'Search by slug, resource, or action (case-insensitive)',
    }),
    ApiResponse({
      status: 200,
      description: 'List of permissions retrieved successfully',
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - Insufficient permissions',
    }),
  );
}

export function ToggleRoleSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Toggle role active status',
      description:
        'Toggle a role between active and inactive. Inactive roles cannot be assigned to new users. Requires UPDATE permission on Role resource.',
    }),
    ApiParam({
      name: 'id',
      description: 'Role ID',
      example: 'role::123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'Role status toggled successfully',
      type: RoleResponseDto,
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' }),
    ApiResponse({ status: 404, description: 'Not Found - Role not found' }),
  );
}

export function GetAllRolesSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get all roles',
      description:
        'Retrieve a paginated list of all roles. Supports search by name, optional filter by active status, and pagination.',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Number of items per page',
    }),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      description: 'Page number',
    }),
    ApiQuery({
      name: 'q',
      required: false,
      type: String,
      description: 'Search by role name (case-insensitive)',
    }),
    ApiQuery({
      name: 'isActive',
      required: false,
      type: Boolean,
      description: 'Filter by active status (true = active or legacy without flag, false = explicitly inactive)',
    }),
    ApiResponse({
      status: 200,
      description: 'List of roles retrieved successfully',
      type: [RoleResponseDto],
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - Insufficient permissions',
    }),
  );
}

export function GetRoleByIdSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get a role by ID',
      description: 'Retrieve a single role by its unique ID.',
    }),
    ApiParam({
      name: 'id',
      description: 'Role ID',
      example: 'role::123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'Role retrieved successfully',
      type: RoleResponseDto,
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - Insufficient permissions',
    }),
    ApiResponse({ status: 404, description: 'Not Found - Role not found' }),
  );
}
