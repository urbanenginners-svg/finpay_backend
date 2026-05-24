import { applyDecorators } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { LoginResponseDto, MeResponseDto } from "./dto";

export function LoginSwagger() {
    return applyDecorators(
        ApiOperation({ summary: 'Login', description: 'Authenticate any user by email and password and return a JWT access token' }),
        ApiResponse({
            status: 200,
            description: 'Login successful',
            type: LoginResponseDto,
        }),
        ApiResponse({
            status: 401,
            description: 'Unauthorized - Invalid credentials or account inactive',
        }),
    );
}

export function SuperAdminLoginSwagger() {
    return applyDecorators(
        ApiBearerAuth(),
        ApiOperation({summary: 'Super Admin Login', description: 'Authenticate a super admin user and return a JWT access token' }),
        ApiResponse({ 
            status: 200, 
            description: 'Login successful',
            type: LoginResponseDto,
          }),
          ApiResponse({ 
            status: 401, 
            description: 'Unauthorized - Invalid credentials or not a super admin' 
          })
    )
}

export function GetMeSwagger() {
    return applyDecorators(
        ApiBearerAuth(),
        ApiOperation({
            summary: 'Get logged-in user profile',
            description: 'Returns the full profile of the currently authenticated user, including their populated role.',
        }),
        ApiResponse({
            status: 200,
            description: 'User profile retrieved successfully',
            type: MeResponseDto,
        }),
        ApiResponse({
            status: 401,
            description: 'Unauthorized - Missing or invalid token',
        }),
    );
}