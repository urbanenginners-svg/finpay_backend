import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { User, UserDocument, PrivateLimitedDocuments } from 'src/services/mongoose/schemas/user.schema';
import { Role } from 'src/services/mongoose/schemas/role.schema';
import { RoleSlugEnum } from 'src/utils/enums/role-slug.enum';
import { RegistrationStatusEnum } from 'src/utils/enums/registration-status.enum';
import { AadhaarVerificationStatusEnum } from 'src/utils/enums/aadhaar-verification-status.enum';
import { UserTypeEnum } from 'src/utils/enums/user-type.enum';
import {
  CompleteAgentRegistrationDto,
  CompleteUserRegistrationDto,
  LoginSendOtpDto,
  LoginVerifyOtpDto,
  RegisterInitDto,
  RegisterVerifyOtpDto,
  VerifyAadhaarDto,
  VerifyAgentDto,
} from './dto/register.dto';
import { AadhaarVerificationService } from './aadhaar-verification.service';
import { FilesService } from '../files/files.service';
import { SmsService } from 'src/services/sms/sms.service';

interface RegistrationTokenPayload {
  sub: string;
  scope: 'registration';
  userType: UserTypeEnum;
}

@Injectable()
export class RegistrationService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Role.name) private roleModel: Model<Role>,
    private jwtService: JwtService,
    private aadhaarVerificationService: AadhaarVerificationService,
    private filesService: FilesService,
    private readonly smsService: SmsService,
  ) {}

  private roleSlugForUserType(userType: UserTypeEnum): RoleSlugEnum {
    return userType === UserTypeEnum.AGENT
      ? RoleSlugEnum.AGENT
      : RoleSlugEnum.CUSTOMER;
  }

  private async getRoleForUserType(userType: UserTypeEnum) {
    const slug = this.roleSlugForUserType(userType);
    const role = await this.roleModel.findOne({
      slug,
      isActive: { $ne: false },
    });

    if (!role) {
      throw new BadRequestException(`${userType} role is not configured`);
    }

    return role;
  }

  private generateOtp(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private displayNameForSms(user: Pick<User, 'firstName' | 'lastName'>): string {
    const parts = [user.firstName, user.lastName].filter(Boolean);
    const joined = parts.join(' ').trim();
    return joined || 'User';
  }

  private buildOtpSendResponse(phoneNumber: string, otp: string) {
    const response: {
      message: string;
      phoneNumber: string;
      otp?: string;
    } = {
      message: this.smsService.isSmsDeliveryActive()
        ? 'OTP sent successfully'
        : 'OTP generated successfully',
      phoneNumber,
    };

    if (!this.smsService.isSmsDeliveryActive()) {
      response.otp = otp;
    }

    return response;
  }

  private signRegistrationToken(user: UserDocument, userType: UserTypeEnum): string {
    const payload: RegistrationTokenPayload = {
      sub: user._id,
      scope: 'registration',
      userType,
    };

    return this.jwtService.sign(payload, { expiresIn: '2h' });
  }

  private verifyRegistrationToken(token: string): RegistrationTokenPayload {
    try {
      const payload = this.jwtService.verify<RegistrationTokenPayload>(token);

      if (payload.scope !== 'registration') {
        throw new UnauthorizedException('Invalid registration token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Registration session expired. Please start again.');
    }
  }

  private buildAuthResponse(user: UserDocument, role: any) {
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
      userType: user.userType,
      registrationStatus: user.registrationStatus,
      role: role ?? null,
    };
  }

  private assertRegistrationStep(user: UserDocument, expected: RegistrationStatusEnum) {
    if (user.registrationStatus !== expected) {
      throw new BadRequestException(
        `Invalid registration step. Expected ${expected}, got ${user.registrationStatus}`,
      );
    }
  }

  private async linkAgentDocument(
    fileId: string | undefined,
    userId: string,
    label: string,
  ): Promise<string> {
    if (!fileId) {
      throw new BadRequestException(`${label} is required`);
    }

    await this.filesService.findOne(fileId);
    await this.filesService.updateReferenceId(fileId, userId, userId);

    return fileId;
  }

  async initRegistration(dto: RegisterInitDto) {
    const { userType, firstName, lastName, email, phoneNumber, dateOfBirth, password } = dto;

    const existingEmail = await this.userModel.findOne({ email, deletedAt: null });
    if (existingEmail?.registrationStatus === RegistrationStatusEnum.VERIFIED) {
      throw new ConflictException('An account with this email already exists');
    }

    const existingPhone = await this.userModel.findOne({ phoneNumber, deletedAt: null });
    if (
      existingPhone &&
      existingPhone.registrationStatus === RegistrationStatusEnum.VERIFIED
    ) {
      throw new ConflictException('An account with this phone number already exists');
    }

    const role = await this.getRoleForUserType(userType);
    const otp = this.generateOtp();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const hashedPassword = await bcrypt.hash(password, 10);

    let user = existingPhone ?? existingEmail;

    if (user) {
      if (user.registrationStatus === RegistrationStatusEnum.VERIFIED) {
        throw new ConflictException('Account already registered. Please login.');
      }

      user.firstName = firstName;
      user.lastName = lastName;
      user.email = email;
      user.phoneNumber = phoneNumber;
      user.dateOfBirth = new Date(dateOfBirth);
      user.userType = userType;
      user.role = role._id;
      user.registrationStatus = RegistrationStatusEnum.PENDING_OTP;
      user.password = hashedPassword;
    } else {
      user = new this.userModel({
        firstName,
        lastName,
        email,
        phoneNumber,
        dateOfBirth: new Date(dateOfBirth),
        userType,
        role: role._id,
        password: hashedPassword,
        registrationStatus: RegistrationStatusEnum.PENDING_OTP,
        isActive: true,
      });
    }

    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();

    await this.smsService.sendOtpSms({
      phoneNumber,
      name: this.displayNameForSms({ firstName, lastName }),
      otp,
    });

    const registrationToken = this.signRegistrationToken(user, userType);

    return {
      ...this.buildOtpSendResponse(phoneNumber, otp),
      registrationToken,
    };
  }

  async verifyRegistrationOtp(dto: RegisterVerifyOtpDto) {
    const { registrationToken, otp } = dto;
    const payload = this.verifyRegistrationToken(registrationToken);

    const user = await this.userModel
      .findOne({ _id: payload.sub, deletedAt: null })
      .select('+otp');

    if (!user) {
      throw new UnauthorizedException('Registration session not found');
    }

    this.assertRegistrationStep(user, RegistrationStatusEnum.PENDING_OTP);

    if (!user.otp || user.otp !== otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
      throw new UnauthorizedException('OTP expired');
    }

    user.otp = undefined;
    user.otpExpiresAt = undefined;
    user.registrationStatus = RegistrationStatusEnum.STEP1_COMPLETE;
    await user.save();

    const populatedUser = await this.userModel
      .findOne({ _id: user._id, deletedAt: null })
      .populate('role');

    if (!populatedUser) {
      throw new UnauthorizedException('Registration session not found');
    }

    const newRegistrationToken = this.signRegistrationToken(populatedUser, payload.userType);
    const auth = this.buildAuthResponse(populatedUser, populatedUser.role);

    return {
      message: 'OTP verified successfully',
      registrationToken: newRegistrationToken,
      userType: payload.userType,
      ...auth,
    };
  }

  async verifyAadhaar(dto: VerifyAadhaarDto) {
    return this.aadhaarVerificationService.verify(dto);
  }

  async completeUserRegistration(dto: CompleteUserRegistrationDto) {
    const payload = this.verifyRegistrationToken(dto.registrationToken);

    if (payload.userType !== UserTypeEnum.USER) {
      throw new BadRequestException('Invalid registration type for user KYC');
    }

    const user = await this.userModel
      .findOne({ _id: payload.sub, deletedAt: null })
      .populate('role');

    if (!user) {
      throw new UnauthorizedException('Registration session not found');
    }

    this.assertRegistrationStep(user, RegistrationStatusEnum.STEP1_COMPLETE);

    const aadhaarResult = await this.aadhaarVerificationService.verify({
      aadhaarNumber: dto.aadhaarNumber,
      firstName: user.firstName,
      lastName: user.lastName,
      dateOfBirth: user.dateOfBirth?.toISOString().slice(0, 10),
    });

    if (!aadhaarResult.verified) {
      throw new BadRequestException(aadhaarResult.message);
    }

    user.aadhaarNumber = dto.aadhaarNumber;
    user.panCardNumber = dto.panCardNumber.toUpperCase();
    user.aadhaarVerificationStatus = AadhaarVerificationStatusEnum.VERIFIED;
    user.aadhaarVerificationRef = dto.aadhaarVerificationRef ?? aadhaarResult.verificationId;
    user.registrationStatus = RegistrationStatusEnum.VERIFIED;
    await user.save();

    return this.buildAuthResponse(user, user.role);
  }

  async completeAgentRegistration(dto: CompleteAgentRegistrationDto) {
    const payload = this.verifyRegistrationToken(dto.registrationToken);

    if (payload.userType !== UserTypeEnum.AGENT) {
      throw new BadRequestException('Invalid registration type for agent KYC');
    }

    if (dto.isPrivateLimited && !dto.privateLimitedDocuments) {
      throw new BadRequestException(
        'Private limited company documents are required when isPrivateLimited is true',
      );
    }

    const user = await this.userModel
      .findOne({ _id: payload.sub, deletedAt: null })
      .populate('role');

    if (!user) {
      throw new UnauthorizedException('Registration session not found');
    }

    this.assertRegistrationStep(user, RegistrationStatusEnum.STEP1_COMPLETE);

    const aadhaarResult = await this.aadhaarVerificationService.verify({
      aadhaarNumber: dto.aadhaarNumber,
      firstName: user.firstName,
      lastName: user.lastName,
      dateOfBirth: user.dateOfBirth?.toISOString().slice(0, 10),
    });

    if (!aadhaarResult.verified) {
      throw new BadRequestException(aadhaarResult.message);
    }

    const userId = user._id;

    const udhyamAadhaarCertificate = await this.linkAgentDocument(
      dto.udhyamAadhaarCertificate,
      userId,
      'Udhyam Aadhaar certificate',
    );
    const bankCancelCheque = await this.linkAgentDocument(
      dto.bankCancelCheque,
      userId,
      'Bank cancel cheque',
    );
    const gstCertificate = await this.linkAgentDocument(
      dto.gstCertificate,
      userId,
      'GST certificate',
    );

    let privateLimitedDocuments: PrivateLimitedDocuments | undefined;

    if (dto.isPrivateLimited && dto.privateLimitedDocuments) {
      const docs = dto.privateLimitedDocuments;
      privateLimitedDocuments = {
        moaAoa: await this.linkAgentDocument(docs.moaAoa, userId, 'MOA & AOA'),
        certificateOfIncorporation: await this.linkAgentDocument(
          docs.certificateOfIncorporation,
          userId,
          'Certificate of incorporation',
        ),
        gstCertificate: await this.linkAgentDocument(
          docs.gstCertificate,
          userId,
          'Private limited GST certificate',
        ),
        addressProof: await this.linkAgentDocument(
          docs.addressProof,
          userId,
          'Company address proof',
        ),
        companyPanCard: await this.linkAgentDocument(
          docs.companyPanCard,
          userId,
          'Company PAN card',
        ),
        bankCancelCheque: await this.linkAgentDocument(
          docs.bankCancelCheque,
          userId,
          'Private limited bank cancel cheque',
        ),
      };
    }

    user.aadhaarNumber = dto.aadhaarNumber;
    user.panCardNumber = dto.panCardNumber.toUpperCase();
    user.aadhaarVerificationStatus = AadhaarVerificationStatusEnum.VERIFIED;
    user.aadhaarVerificationRef = dto.aadhaarVerificationRef ?? aadhaarResult.verificationId;
    user.agentDocuments = {
      udhyamAadhaarCertificate,
      bankCancelCheque,
      gstCertificate,
      isPrivateLimited: dto.isPrivateLimited,
      ...(privateLimitedDocuments ? { privateLimitedDocuments } : {}),
    };
    user.registrationStatus = RegistrationStatusEnum.PENDING_ADMIN_VERIFICATION;
    await user.save();

    return {
      message:
        'Agent registration submitted successfully. Your account is pending admin verification.',
      registrationStatus: user.registrationStatus,
      userId: user._id,
      userType: user.userType,
    };
  }

  async loginSendOtp(dto: LoginSendOtpDto) {
    const user = await this.userModel.findOne({
      phoneNumber: dto.phoneNumber,
      deletedAt: null,
    });

    if (!user) {
      throw new UnauthorizedException('No account found with this phone number');
    }

    if (user.registrationStatus !== RegistrationStatusEnum.VERIFIED) {
      if (user.registrationStatus === RegistrationStatusEnum.PENDING_ADMIN_VERIFICATION) {
        throw new ForbiddenException(
          'Your agent account is pending admin verification. Please wait for approval.',
        );
      }

      throw new BadRequestException(
        'Registration is incomplete. Please complete signup first.',
      );
    }

    const otp = this.generateOtp();
    user.otp = otp;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await this.smsService.sendOtpSms({
      phoneNumber: dto.phoneNumber,
      name: this.displayNameForSms(user),
      otp,
    });

    return this.buildOtpSendResponse(dto.phoneNumber, otp);
  }

  async loginVerifyOtp(dto: LoginVerifyOtpDto) {
    const user = await this.userModel
      .findOne({ phoneNumber: dto.phoneNumber, deletedAt: null })
      .select('+otp')
      .populate('role');

    if (!user) {
      throw new UnauthorizedException('No account found with this phone number');
    }

    if (user.registrationStatus === RegistrationStatusEnum.PENDING_ADMIN_VERIFICATION) {
      throw new ForbiddenException(
        'Your agent account is pending admin verification. Please wait for approval.',
      );
    }

    if (user.registrationStatus !== RegistrationStatusEnum.VERIFIED) {
      throw new BadRequestException('Please complete registration before logging in.');
    }

    if (!user.otp || user.otp !== dto.otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
      throw new UnauthorizedException('OTP expired');
    }

    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    if (!user.isActive) {
      throw new UnauthorizedException('Your account is inactive. Please contact support.');
    }

    const role = user.role as any;
    if (role && role.isActive === false) {
      throw new UnauthorizedException('Your role is inactive. Please contact support.');
    }

    return this.buildAuthResponse(user, role);
  }

  async verifyAgent(userId: string, dto: VerifyAgentDto, adminUserId: string) {
    const user = await this.userModel.findOne({ _id: userId, deletedAt: null }).populate('role');

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.userType !== UserTypeEnum.AGENT) {
      throw new BadRequestException('User is not an agent');
    }

    if (user.registrationStatus !== RegistrationStatusEnum.PENDING_ADMIN_VERIFICATION) {
      throw new BadRequestException('Agent is not pending verification');
    }

    if (dto.approved) {
      user.registrationStatus = RegistrationStatusEnum.VERIFIED;
      user.rejectionReason = undefined;
    } else {
      user.registrationStatus = RegistrationStatusEnum.REJECTED;
      user.rejectionReason = dto.rejectionReason ?? 'Rejected by admin';
    }

    user.lastUpdatedBy = adminUserId;
    await user.save();

    return {
      message: dto.approved
        ? 'Agent verified successfully'
        : 'Agent registration rejected',
      userId: user._id,
      registrationStatus: user.registrationStatus,
    };
  }
}
