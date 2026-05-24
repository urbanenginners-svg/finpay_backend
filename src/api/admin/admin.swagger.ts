import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { UserResponseDto } from './dto';

export function CreateUserSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Create a new user',
      description:
        'Creates a new user with the specified roles. All provided role IDs are validated against the roles collection before creation. Requires WRITE permission on User resource.',
    }),
    ApiResponse({
      status: 201,
      description: 'User created successfully',
      type: UserResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: 'Bad Request - Invalid input data or one or more roles not found',
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - Insufficient permissions',
    }),
    ApiResponse({
      status: 409,
      description: 'Conflict - User with this email or phone number already exists',
    }),
  );
}

export function GetAllUsersSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get all users',
      description:
        'Returns a paginated list of all users. Optionally filter by role ID. Text search uses the `q` parameter only and matches first name, last name, or email (case-insensitive substring). Requires READ permission on User resource.',
    }),
    ApiQuery({
      name: 'roleId',
      required: false,
      description: 'Filter users by Role ID',
      example: 'role::123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 }),
    ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 10 }),
    ApiQuery({
      name: 'q',
      required: false,
      description: 'Case-insensitive substring match on firstName, lastName, or email',
    }),
    ApiQuery({
      name: 'isActive',
      required: false,
      description: 'Filter by active status',
      example: true,
    }),
    ApiResponse({
      status: 200,
      description: 'Users retrieved successfully',
      type: UserResponseDto,
      isArray: true,
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' }),
  );
}

export function GetUserByIdSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get a user by ID',
      description: 'Returns a single user by their ID. Requires READ permission on User resource.',
    }),
    ApiParam({
      name: 'id',
      description: 'User ID',
      example: 'user::123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'User retrieved successfully',
      type: UserResponseDto,
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' }),
    ApiResponse({ status: 404, description: 'Not Found - User does not exist' }),
  );
}

export function UpdateUserSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Update a user',
      description:
        'Updates a user by ID. If role IDs are provided, they are validated before updating. If a new password is provided, it will be hashed. Requires UPDATE permission on User resource.',
    }),
    ApiParam({
      name: 'id',
      description: 'User ID',
      example: 'user::123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'User updated successfully',
      type: UserResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: 'Bad Request - Invalid input or roles not found',
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' }),
    ApiResponse({ status: 404, description: 'Not Found - User does not exist' }),
  );
}

export function DeleteUserSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Delete a user',
      description:
        'Soft deletes a user by setting the deletedAt timestamp. The user record is retained in the database. Requires DELETE permission on User resource.',
    }),
    ApiParam({
      name: 'id',
      description: 'User ID',
      example: 'user::123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'User deleted successfully',
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' }),
    ApiResponse({ status: 404, description: 'Not Found - User does not exist' }),
  );
}
