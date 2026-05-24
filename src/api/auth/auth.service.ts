import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { User, UserDocument } from 'src/services/mongoose/schemas/user.schema';
import { Role } from 'src/services/mongoose/schemas/role.schema';
import { RoleSlugEnum } from 'src/utils/enums/role-slug.enum';
import {
  LoginDto,
  SendOtpDto,
  SendUnifiedOtpDto,
  VerifyOtpDto,
  VerifyUnifiedOtpDto,
} from './dto';
import { OtpPortalType } from 'src/utils/enums/otp-portal-type.enum';
import { SmsService } from 'src/services/sms/sms.service';
import { SMS_TEMPLATE_KEYS } from 'src/services/sms/mappings/sms-template.registry';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Role.name) private roleModel: Model<Role>,
    private jwtService: JwtService,
    private readonly smsService: SmsService,
  ) {}

  private roleSlugForOtpPortal(portal: OtpPortalType): RoleSlugEnum {
    switch (portal) {
      case OtpPortalType.CUSTOMER:
        return RoleSlugEnum.CUSTOMER;
      case OtpPortalType.WAREHOUSE_ASSOCIATE:
        return RoleSlugEnum.WAREHOUSE_ASSOCIATE;
      case OtpPortalType.SOURCING_PANEL:
        return RoleSlugEnum.SOURCING_MANAGER;
      default:
        throw new BadRequestException('Invalid user type');
    }
  }

  private async persistOtpForUser(user: UserDocument): Promise<{ otp: string }> {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();
    return { otp };
  }

  private displayNameForSms(user: UserDocument): string {
    const parts = [user.firstName, user.lastName].filter(Boolean);
    const joined = parts.join(' ').trim();
    return joined || 'Customer';
  }

  /**
   * Sends the DLT customer OTP template via Airtel (no-op / dry-run when AIRTEL_ACTIVE_MODE !== "true").
   */
  private async sendCustomerLoginOtpSms(
    user: UserDocument,
    otp: string,
  ): Promise<void> {
    await this.smsService.sendTemplatedSms({
      templateKey: SMS_TEMPLATE_KEYS.CUSTOMER_OTP,
      destinations: user.phoneNumber,
      variables: {
        name: this.displayNameForSms(user),
        otp,
      },
    });
  }

  /**
   * OTP login for multiple portals (customer self-signup vs staff-only existing accounts).
   */
  async sendUnifiedOtp(dto: SendUnifiedOtpDto) {
    const { phoneNumber, userType } = dto;
    const requiredSlug = this.roleSlugForOtpPortal(userType);

    if (userType === OtpPortalType.CUSTOMER) {
      let user = await this.userModel.findOne({ phoneNumber, deletedAt: null });

      if (!user) {
        const customerRole = await this.roleModel.findOne({
          slug: RoleSlugEnum.CUSTOMER,
          isActive: { $ne: false },
        });
        if (!customerRole) {
          throw new BadRequestException('Customer role not found');
        }
        user = new this.userModel({
          phoneNumber,
          role: customerRole._id,
          isActive: true,
        });
      }

      const { otp } = await this.persistOtpForUser(user);
      await this.sendCustomerLoginOtpSms(user, otp);
      return { message: 'OTP sent successfully', otp };
    }

    const portalRole = await this.roleModel.findOne({
      slug: requiredSlug,
      isActive: { $ne: false },
    });
    if (!portalRole) {
      throw new BadRequestException('Requested user role is not configured');
    }

    const user = await this.userModel
      .findOne({ phoneNumber, deletedAt: null })
      .populate('role');

    if (!user) {
      throw new UnauthorizedException(
        'No account found for this phone number. Ask an administrator to add you.',
      );
    }

    const roleDoc = user.role as any;
    if (!roleDoc || roleDoc.slug !== requiredSlug) {
      throw new ForbiddenException(
        'This phone number is not registered for this app. Use the correct login type.',
      );
    }

    const { otp } = await this.persistOtpForUser(user);
    await this.sendCustomerLoginOtpSms(user, otp);
    return { message: 'OTP sent successfully', otp };
  }

  async verifyUnifiedOtp(dto: VerifyUnifiedOtpDto) {
    const { phoneNumber, otp, userType } = dto;
    const requiredSlug = this.roleSlugForOtpPortal(userType);

    const user = await this.userModel
      .findOne({ phoneNumber, deletedAt: null })
      .select('+otp')
      .populate('role');

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const roleDoc = user.role as any;
    if (!roleDoc || roleDoc.slug !== requiredSlug) {
      throw new ForbiddenException(
        'This phone number is not registered for this app. Use the correct login type.',
      );
    }

    if (!user.otp || user.otp !== otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
      throw new UnauthorizedException('OTP expired');
    }

    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Your account is inactive. Please contact an administrator.',
      );
    }

    if (roleDoc && roleDoc.isActive === false) {
      throw new UnauthorizedException(
        'Your role is inactive. Please contact an administrator.',
      );
    }

    const role = user.role as any;

    const payload = {
      sub: user._id,
      phoneNumber: user.phoneNumber,
      roleId: role?._id ?? role ?? null,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      userId: user._id,
      phoneNumber: user.phoneNumber,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePic: user.profilePic,
      role: role ?? null,
    };
  }

  async sendOtp(sendOtpDto: SendOtpDto) {
    const { phoneNumber } = sendOtpDto;

    let user = await this.userModel.findOne({ phoneNumber, deletedAt: null });

    if (!user) {
      // Create new customer user
      const customerRole = await this.roleModel.findOne({
        slug: RoleSlugEnum.CUSTOMER,
        isActive: { $ne: false },
      });
      if (!customerRole) {
        throw new BadRequestException('Customer role not found');
      }

      user = new this.userModel({
        phoneNumber,
        role: customerRole._id,
        isActive: true,
      });
    }

    const { otp } = await this.persistOtpForUser(user);
    await this.sendCustomerLoginOtpSms(user, otp);
    return { message: 'OTP sent successfully', otp };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { phoneNumber, otp } = verifyOtpDto;

    const user = await this.userModel
      .findOne({ phoneNumber, deletedAt: null })
      .select('+otp')
      .populate('role');

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.otp || user.otp !== otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
      throw new UnauthorizedException('OTP expired');
    }

    // Clear OTP
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    if (!user.isActive) {
      throw new UnauthorizedException('Your account is inactive. Please contact an administrator.');
    }

    const role = user.role as any;
    if (role && role.isActive === false) {
      throw new UnauthorizedException(
        'Your role is inactive. Please contact an administrator.',
      );
    }

    const payload = {
      sub: user._id,
      phoneNumber: user.phoneNumber,
      roleId: role?._id ?? role ?? null,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      userId: user._id,
      phoneNumber: user.phoneNumber,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePic: user.profilePic,
      role: role ?? null,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userModel
      .findOne({ email, deletedAt: null })
      .populate('role')
      .exec();

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account is inactive. Please contact an administrator.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const role = user.role as any;
    if (role && role.isActive === false) {
      throw new UnauthorizedException(
        'Your role is inactive. Please contact an administrator.',
      );
    }

    const payload = {
      sub: user._id,
      email: user.email,
      roleId: role?._id ?? role ?? null,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      userId: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePic: user.profilePic,
      role: role ?? null,
    };
  }

  async superAdminLogin(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user by email and populate roles
    const user = await this.userModel
      .findOne({ email })
      .populate('role')
      .exec();

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user has Super Admin role
    const role = user.role as any;
    if (role && role.isActive === false) {
      throw new UnauthorizedException(
        'Your role is inactive. Please contact an administrator.',
      );
    }
    const isSuperAdmin = role && role.name === 'Super Admin';

    if (!isSuperAdmin) {
      throw new UnauthorizedException('Access denied. Super Admin privileges required.');
    }

    // Generate JWT token
    const payload = {
      sub: user._id,
      email: user.email,
      roleId: role?._id ?? role ?? null,
    };

    const access_token = this.jwtService.sign(payload);

    // Return user info with token
    return {
      access_token,
      userId: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePic: user.profilePic,
      role: role ?? null,
    };
  }

  async getPopulatedUser(userId: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ _id: userId, deletedAt: null })
      .populate({
        path: 'role',
        populate: { path: 'permissions' },
      })
      .exec();
  }

  /**
   * Asserts that the current user is the one this task is assigned to.
   * Throws ForbiddenException if the IDs do not match.
   */
  assertIsAssignedUser(
    task: UserDocument,
    userId: string,
  ): void {
    if (String(task._id) !== String(userId)) {
      throw new ForbiddenException(
        'Only the assigned warehouse associate can perform this action.',
      );
    }
  }
}
