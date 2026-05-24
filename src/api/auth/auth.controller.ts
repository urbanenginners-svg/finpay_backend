import { Body, Controller, Get, Post, Version } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";

import { AuthService } from "./auth.service";
import { DataResponse } from "src/utils/response";
import {
  LoginDto,
  SendOtpDto,
  SendUnifiedOtpDto,
  VerifyOtpDto,
  VerifyUnifiedOtpDto,
} from "./dto";
import { SuperAdminLoginSwagger, LoginSwagger, GetMeSwagger } from "./auth.swagger";
import { Public } from "src/utils/decorators/public-key.decorator";
import { GetUser } from "src/utils/decorators/get-user.decorator";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Version('1')
  @Post('customer/send-otp')
  @ApiOperation({ summary: 'Send OTP for customer login/registration' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    const result = await this.authService.sendOtp(sendOtpDto);
    return new DataResponse(result);
  }

  @Public()
  @Version('1')
  @Post('customer/verify-otp')
  @ApiOperation({ summary: 'Verify OTP and login customer' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    const result = await this.authService.verifyOtp(verifyOtpDto);
    return new DataResponse(result);
  }

  @Public()
  @Version('1')
  @Post('otp/send')
  @ApiOperation({
    summary: 'Send OTP (multi-portal)',
    description:
      'Sends an OTP for the given phone and user type. Customer: creates account if needed. Warehouse associate and sourcing panel: phone must already belong to a user with that role.',
  })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiResponse({ status: 401, description: 'No account for staff portal' })
  @ApiResponse({ status: 403, description: 'Phone not registered for this portal' })
  async sendUnifiedOtp(@Body() dto: SendUnifiedOtpDto) {
    const result = await this.authService.sendUnifiedOtp(dto);
    return new DataResponse(result);
  }

  @Public()
  @Version('1')
  @Post('otp/verify')
  @ApiOperation({
    summary: 'Verify OTP and login (multi-portal)',
    description:
      'Validates OTP and returns a JWT. The user must match the requested userType (role).',
  })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  @ApiResponse({ status: 403, description: 'Phone not registered for this portal' })
  async verifyUnifiedOtp(@Body() dto: VerifyUnifiedOtpDto) {
    const result = await this.authService.verifyUnifiedOtp(dto);
    return new DataResponse(result);
  }

  @Public()
  @Version('1')
  @Post('login')
  @LoginSwagger()
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    return new DataResponse(result);
  }

  @Public()
  @Version("1")
  @Post("superadmin/login")
  @SuperAdminLoginSwagger()
  async superAdminLogin(@Body() loginDto: LoginDto) {
    const result = await this.authService.superAdminLogin(loginDto);
    return new DataResponse(result);
  }

  @Version('1')
  @Get('me')
  @GetMeSwagger()
  async getMe(@GetUser('_id') userId: string) {
    const user = await this.authService.getPopulatedUser(userId);
    return new DataResponse(user);
  }
}
