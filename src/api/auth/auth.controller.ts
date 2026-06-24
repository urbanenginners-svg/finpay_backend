import { Body, Controller, Get, Post, Version } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";

import { AuthService } from "./auth.service";
import { RegistrationService } from "./registration.service";
import { DataResponse } from "src/utils/response";
import {
  LoginDto,
  SendOtpDto,
  SendUnifiedOtpDto,
  VerifyOtpDto,
  VerifyUnifiedOtpDto,
} from "./dto";
import {
  CompleteAgentRegistrationDto,
  CompleteUserRegistrationDto,
  LoginSendOtpDto,
  LoginVerifyOtpDto,
  PasswordLoginDto,
  RegisterInitDto,
  RegisterVerifyOtpDto,
  VerifyAadhaarDto,
} from "./dto/register.dto";
import { SuperAdminLoginSwagger, LoginSwagger, GetMeSwagger } from "./auth.swagger";
import { Public } from "src/utils/decorators/public-key.decorator";
import { GetUser } from "src/utils/decorators/get-user.decorator";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private registrationService: RegistrationService,
  ) {}

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

  @Public()
  @Version('1')
  @Post('register/init')
  @ApiOperation({ summary: 'Start user or agent registration (step 1)' })
  async registerInit(@Body() dto: RegisterInitDto) {
    const result = await this.registrationService.initRegistration(dto);
    return new DataResponse(result);
  }

  @Public()
  @Version('1')
  @Post('register/verify-otp')
  @ApiOperation({ summary: 'Verify registration OTP (step 1 complete)' })
  async registerVerifyOtp(@Body() dto: RegisterVerifyOtpDto) {
    const result = await this.registrationService.verifyRegistrationOtp(dto);
    return new DataResponse(result);
  }

  @Public()
  @Version('1')
  @Post('aadhaar/verify')
  @ApiOperation({
    summary: 'Mock Aadhaar verification',
    description:
      'Placeholder for third-party Aadhaar verification. Returns mock verification result. Fails if Aadhaar ends with 0000.',
  })
  async verifyAadhaar(@Body() dto: VerifyAadhaarDto) {
    const result = await this.registrationService.verifyAadhaar(dto);
    return new DataResponse(result);
  }

  @Public()
  @Version('1')
  @Post('register/user/complete')
  @ApiOperation({ summary: 'Complete user registration KYC (step 2)' })
  async completeUserRegistration(@Body() dto: CompleteUserRegistrationDto) {
    const result = await this.registrationService.completeUserRegistration(dto);
    return new DataResponse(result);
  }

  @Public()
  @Version('1')
  @Post('register/agent/complete')
  @ApiOperation({ summary: 'Complete agent registration KYC (step 2)' })
  async completeAgentRegistration(@Body() dto: CompleteAgentRegistrationDto) {
    const result = await this.registrationService.completeAgentRegistration(dto);
    return new DataResponse(result);
  }

  @Public()
  @Version('1')
  @Post('login/password')
  @ApiOperation({ summary: 'Login with email or mobile number and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async loginWithPassword(@Body() dto: PasswordLoginDto) {
    const result = await this.registrationService.loginWithPassword(dto);
    return new DataResponse(result);
  }

  @Public()
  @Version('1')
  @Post('login/send-otp')
  @ApiOperation({ summary: 'Send OTP for login (returns OTP in response)' })
  async loginSendOtp(@Body() dto: LoginSendOtpDto) {
    const result = await this.registrationService.loginSendOtp(dto);
    return new DataResponse(result);
  }

  @Public()
  @Version('1')
  @Post('login/verify-otp')
  @ApiOperation({ summary: 'Verify login OTP and receive JWT' })
  async loginVerifyOtp(@Body() dto: LoginVerifyOtpDto) {
    const result = await this.registrationService.loginVerifyOtp(dto);
    return new DataResponse(result);
  }
}
